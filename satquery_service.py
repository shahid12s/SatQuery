import base64
import io
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


# ============================================================
# ENVIRONMENT
# ============================================================

def load_env():
    """Load HF token from .env if present."""

    env_paths = [
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]

    for env_path in env_paths:
        if env_path.exists():

            with open(env_path, "r", encoding="utf-8") as f:

                for line in f:
                    line = line.strip()

                    if (
                        not line
                        or line.startswith("#")
                        or "=" not in line
                    ):
                        continue

                    key, value = line.split("=", 1)

                    os.environ.setdefault(
                        key.strip(),
                        value.strip().strip("'\"")
                    )


# ============================================================
# PARSE MODEL OUTPUT
# ============================================================

def parse_bounding_boxes(text):
    """
    Extract bounding boxes and object label from SatQuery output.

    Example model output:

    <|object_ref_start|>vehicle<|object_ref_end|>
    (120,200),(500,600)
    """

    text = str(text)

    # Extract coordinates
    box_matches = re.findall(
        r"\((\d+),\s*(\d+)\),\s*\((\d+),\s*(\d+)\)",
        text
    )

    # Extract object label
    label_match = re.search(
        r"<\|object_ref_start\|>(.*?)<\|object_ref_end\|>",
        text
    )

    label = (
        label_match.group(1).strip()
        if label_match
        else "object"
    )

    boxes = []

    for match in box_matches:

        x1, y1, x2, y2 = map(int, match)

        boxes.append({
            "label": label,
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2
        })

    return label, boxes


# ============================================================
# CLEAN TEXTUAL ANSWER
# ============================================================

def clean_answer_text(raw_text):
    """
    Convert SatQuery raw output into readable text.

    Removes:
        <|object_ref_start|>
        <|object_ref_end|>
        coordinate strings
        other special tokens
    """

    text = str(raw_text)

    # Remove SatQuery special tokens
    text = re.sub(
        r"<\|[^>]+>",
        "",
        text
    )

    # Remove bounding boxes
    text = re.sub(
        r"\(\d+,\s*\d+\),\s*\(\d+,\s*\d+\)",
        "",
        text
    )

    # Clean whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    return text


# ============================================================
# DRAW GROUNDING
# ============================================================

def create_grounded_image(
    image_path,
    boxes
):
    """
    Draw bounding boxes on returned image.

    IMPORTANT:
    We use the coordinates exactly as returned by SatQuery,
    matching the original implementation.
    """

    image = Image.open(
        image_path
    ).convert("RGB")

    draw = ImageDraw.Draw(image)

    for box in boxes:

        x1 = box["x1"]
        y1 = box["y1"]
        x2 = box["x2"]
        y2 = box["y2"]

        draw.rectangle(
            [x1, y1, x2, y2],
            outline="red",
            width=4
        )

    return image


# ============================================================
# IMAGE -> BASE64 DATA URL
# ============================================================

def image_to_data_url(image):
    """Convert PIL Image to JPEG Data URL."""

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="JPEG",
        quality=92
    )

    encoded = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    return (
        "data:image/jpeg;base64,"
        + encoded
    )


# ============================================================
# MAIN REUSABLE FUNCTION
# ============================================================

def grounded_image_qa(
    image_path,
    question
):
    """
    Main function.

    Parameters
    ----------
    image_path : str
        Path to input image.

    question : str
        Question about the image.

    Returns
    -------
    dict

        {
            "answer": "...",
            "raw": "...",
            "label": "...",
            "boxes": [...],
            "evidenceImage": "data:image/jpeg;base64,..."
        }
    """

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not image_path:
        raise ValueError(
            "image_path cannot be empty."
        )

    if not os.path.exists(image_path):
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    if not question or not question.strip():
        raise ValueError(
            "Question cannot be empty."
        )

    question = question.strip()

    # --------------------------------------------------------
    # Load environment
    # --------------------------------------------------------

    load_env()

    token = (
        os.getenv("HF_TOKEN")
        or os.getenv("HF")
    )

    # --------------------------------------------------------
    # Authenticate
    # --------------------------------------------------------

    if token:

        from huggingface_hub import login

        login(
            token,
            add_to_git_credential=False
        )

    # --------------------------------------------------------
    # Import Gradio
    # --------------------------------------------------------

    from gradio_client import (
        Client,
        handle_file
    )

    # --------------------------------------------------------
    # Connect to SatQuery
    # --------------------------------------------------------

    client = Client(
        "maanas1234321/satquery-ai"
    )

    # --------------------------------------------------------
    # Send image + question
    # --------------------------------------------------------

    result = client.predict(
        image=handle_file(image_path),
        question=question,
        api_name="/answer_1"
    )

    # --------------------------------------------------------
    # Debug
    # --------------------------------------------------------

    print(
        "[DEBUG] SatQuery result:",
        repr(result),
        file=sys.stderr
    )

    # --------------------------------------------------------
    # Validate result
    # --------------------------------------------------------

    if not isinstance(
        result,
        (list, tuple)
    ):
        raise RuntimeError(
            "Unexpected SatQuery response type: "
            f"{type(result)}"
        )

    if len(result) == 0:
        raise RuntimeError(
            "SatQuery returned an empty response."
        )

    # --------------------------------------------------------
    # SatQuery structure from your original code:
    #
    # result[0] -> grounding/model output
    # result[1] -> returned image path
    # --------------------------------------------------------

    raw_output = str(
        result[0]
    )

    returned_image_path = (
        result[1]
        if len(result) > 1
        else image_path
    )

    # --------------------------------------------------------
    # Parse grounding
    # --------------------------------------------------------

    label, boxes = parse_bounding_boxes(
        raw_output
    )

    # --------------------------------------------------------
    # Create grounded image
    # --------------------------------------------------------

    grounded_image = create_grounded_image(
        returned_image_path,
        boxes
    )

    # --------------------------------------------------------
    # Convert grounded image to Data URL
    # --------------------------------------------------------

    evidence_image = image_to_data_url(
        grounded_image
    )

    # --------------------------------------------------------
    # Extract textual answer
    # --------------------------------------------------------

    answer = clean_answer_text(
        raw_output
    )

    # --------------------------------------------------------
    # Return final result
    # --------------------------------------------------------

    return {
        "answer": answer,
        "raw": raw_output,
        "label": label,
        "boxes": boxes,
        "evidenceImage": evidence_image
    }


# ============================================================
# JSON/BASE64 WRAPPER
# ============================================================

def process_json_request(payload):
    """
    Accept frontend-style JSON:

    {
        "question": "...",
        "imageDataUrl": "data:image/jpeg;base64,..."
    }

    Returns the same JSON-friendly result.
    """

    question = payload.get(
        "question",
        ""
    ).strip()

    data_url = payload.get(
        "imageDataUrl",
        ""
    )

    if not question:
        return {
            "error": "Question cannot be empty."
        }

    if not data_url:
        return {
            "error": "No image data URL provided."
        }

    # --------------------------------------------------------
    # Extract base64
    # --------------------------------------------------------

    header, separator, base64_str = (
        data_url.partition(",")
    )

    if not separator:
        base64_str = header

    try:

        image_bytes = base64.b64decode(
            base64_str,
            validate=True
        )

    except Exception as e:

        return {
            "error":
                f"Failed to decode image: {e}"
        }

    # --------------------------------------------------------
    # Write temporary image
    # --------------------------------------------------------

    temp_path = None

    try:

        with tempfile.NamedTemporaryFile(
            suffix=".jpg",
            delete=False
        ) as tmp:

            tmp.write(image_bytes)

            temp_path = tmp.name

        # ----------------------------------------------------
        # Run model
        # ----------------------------------------------------

        result = grounded_image_qa(
            temp_path,
            question
        )

        return result

    except Exception as e:

        import traceback

        traceback.print_exc(
            file=sys.stderr
        )

        return {
            "error": str(e)
        }

    finally:

        if (
            temp_path
            and os.path.exists(temp_path)
        ):

            try:
                os.remove(temp_path)

            except OSError:
                pass


# ============================================================
# COMMAND LINE ENTRY POINT
# ============================================================

def main():

    try:

        # ----------------------------------------------------
        # JSON input from file or stdin
        # ----------------------------------------------------

        if len(sys.argv) > 1:

            with open(
                sys.argv[1],
                "r",
                encoding="utf-8"
            ) as f:

                payload = json.load(f)

        else:

            payload = json.loads(
                sys.stdin.read()
            )

        # ----------------------------------------------------
        # Process
        # ----------------------------------------------------

        output = process_json_request(
            payload
        )

        # ----------------------------------------------------
        # Output
        # ----------------------------------------------------

        print(
            "__JSON_START__"
            + json.dumps(output)
            + "__JSON_END__"
        )

    except Exception as e:

        print(
            "__JSON_START__"
            + json.dumps({
                "error": str(e)
            })
            + "__JSON_END__"
        )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()
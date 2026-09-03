import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

export type UploadedImage = {
  id: string
  name: string
  size: number
  previewUrl: string
  file: File
}

type UploadDropzoneProps = {
  onImagesSelected: (files: File[]) => void
}

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/tiff', 'image/geotiff']

export function UploadDropzone({ onImagesSelected }: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function selectFiles(fileList: FileList | null) {
    if (!fileList) return

    const files = Array.from(fileList).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return acceptedImageTypes.includes(file.type) || extension === 'tif' || extension === 'tiff' || extension === 'geotiff'
    })

    if (files.length > 0) onImagesSelected(files)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(false)
    selectFiles(event.dataTransfer.files)
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(event.target.files)
    event.target.value = ''
  }

  return (
    <section
      className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
      aria-label="Upload images"
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept="image/jpeg,image/png,image/tiff,.tif,.tiff,.geotiff"
        multiple
        onChange={handleFileInputChange}
      />
      <div className="upload-icon" aria-hidden="true" />
      <p>Drag & drop one or more images here</p>
      <span>or</span>
      <button type="button" onClick={() => fileInputRef.current?.click()}>Upload Images</button>
      <small>Supports JPG, PNG, TIFF, GeoTIFF<br />Max size: 50MB per file</small>
    </section>
  )
}

export function UploadedImages({ images }: { images: UploadedImage[] }) {
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(null)

  return (
    <aside className="uploaded-card" aria-label="Uploaded images preview">
      <h3>Uploaded Images</h3>
      {images.length > 0 ? (
        <div className="uploaded-list">
          {images.map((image) => (
            <button className="uploaded-item" key={image.id} type="button" onClick={() => setPreviewImage(image)}>
              <img src={image.previewUrl} alt="" />
              <span className="uploaded-meta">
                <span>{image.name}</span>
                <small>{formatFileSize(image.size)}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="image-placeholder" aria-hidden="true" />
          <p>No images uploaded yet</p>
        </>
      )}

      {previewImage ? <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} /> : null}
    </aside>
  )
}

function ImagePreviewModal({ image, onClose }: { image: UploadedImage; onClose: () => void }) {
  return (
    <div className="preview-backdrop" role="presentation" onClick={onClose}>
      <div className="preview-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${image.name}`} onClick={(event) => event.stopPropagation()}>
        <header className="preview-header">
          <div>
            <h3>{image.name}</h3>
            <p>{formatFileSize(image.size)}</p>
          </div>
          <button className="preview-close" type="button" aria-label="Close preview" onClick={onClose}>x</button>
        </header>
        <div className="preview-image-frame">
          <img src={image.previewUrl} alt={image.name} />
        </div>
      </div>
    </div>
  )
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

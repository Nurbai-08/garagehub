import { IMAGE_TYPES, MAX_IMAGE_SIZE_MB, MAX_PHOTOS, useCarPhotos } from "../model/useCarPhotos";
import "./car-photos.css";

export function CarPhotoPicker({
  gallery,
  disabled,
}: {
  gallery: ReturnType<typeof useCarPhotos>;
  disabled: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor="car-photos">Фотографии * · {gallery.photos.length} / {MAX_PHOTOS}</label>
      <p id="photo-help">От 1 до 5 фото. Можно добавлять по одному. JPG, PNG или WebP до {MAX_IMAGE_SIZE_MB} MB каждый.</p>
      <p className="photo-edit-help">Удалите ненужные фото кнопкой под снимком, затем сохраните изменения. Если удалить обложку, главным станет следующее фото. Оставьте хотя бы одно фото.</p>
      <div className="file-drop photo-drop">
        <input
          id="car-photos"
          type="file"
          multiple
          accept={IMAGE_TYPES.join(",")}
          disabled={disabled || gallery.photos.length === MAX_PHOTOS}
          aria-describedby="photo-help photo-error"
          onChange={(event) => {
            gallery.add(event.target.files);
            event.target.value = "";
          }}
        />
        <span>{gallery.photos.length === MAX_PHOTOS ? "Добавлено 5 фото — удалите одно, чтобы заменить" : "Добавить фотографии"}</span>
      </div>
      <div className="photo-picker-previews">
        {gallery.photos.map((photo, index) => (
          <figure key={photo.id}>
            <img src={photo.preview} alt={`Фото ${index + 1}`} />
            <figcaption>{index === 0 ? "Обложка" : `Фото ${index + 1}`}</figcaption>
            <div className="photo-picker-actions">
              {index > 0 && (
                <button type="button" disabled={disabled} onClick={() => gallery.makeCover(photo.id)} aria-label={`Сделать фото ${index + 1} обложкой`}>
                  На обложку
                </button>
              )}
              <button type="button" disabled={disabled} onClick={() => gallery.remove(photo.id)} aria-label={`Удалить фото ${index + 1}`}>
                Удалить
              </button>
            </div>
          </figure>
        ))}
      </div>
      <div id="photo-error" role="alert" className="field-error">{gallery.error}</div>
    </div>
  );
}

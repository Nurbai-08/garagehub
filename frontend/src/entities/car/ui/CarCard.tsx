import { Images, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Car } from "../model/types";

export function CarCard({
  car,
  featured = false,
}: {
  car: Car;
  featured?: boolean;
}) {
  return (
    <article className={featured ? "car-card featured" : "car-card"}>
      <Link to={`/cars/${car.id}`} className="car-photo">
        <img
          src={car.cover_image_url}
          alt={`${car.brand} ${car.model}`}
          loading="lazy"
        />
        <div className="year">{car.year}</div>
        <div className="photo-count">
          <Images size={14} /> {car.image_urls.length || 1}
        </div>
      </Link>
      <div className="car-info">
        <div>
          <small>{car.brand}</small>
          <h3>{car.model}</h3>
        </div>
        <div className="rating">
          <Star size={14} fill="currentColor" /> {car.rating_avg.toFixed(1)}
        </div>
      </div>
      <div className="car-spec">
        <span>
          {car.power_hp
            ? `${car.power_hp} л.с.`
            : car.generation || "Без лишних цифр"}
        </span>
        <span>@{car.owner_username}</span>
      </div>
    </article>
  );
}

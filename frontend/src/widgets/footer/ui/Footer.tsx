import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth";
import { BrandMark } from "@/shared/ui/BrandMark";

export function Footer() {
  const { user, logout, isRestoring } = useAuth();

  return (
    <footer>
      <div className="footer-about">
        <Link to="/" className="brand" aria-label="Гараж — главная">
          <BrandMark />
          гараж
        </Link>
        <p>
          Машины, фотографии
          <br />и свои люди.
        </p>
      </div>
      <nav aria-label="Разделы сайта">
        <p>Гараж</p>
        <Link to="/explore">Машины</Link>
        <Link to="/feed">Лента</Link>
        <Link to="/garage">Моя подборка</Link>
      </nav>
      <nav className="footer-account" aria-label="Аккаунт">
        <p>Аккаунт</p>
        {isRestoring ? (
          <span className="footer-auth-loading">Загружаем профиль…</span>
        ) : user ? (
          <>
            <Link to={`/users/${user.username}`}>@{user.username}</Link>
            <Link to="/favorites">Избранное</Link>
            <button type="button" onClick={() => void logout()}>
              <LogOut size={15} /> Выйти
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Войти</Link>
            <Link to="/register">Создать профиль</Link>
          </>
        )}
      </nav>
      <small>
        <span>Гараж © 2026</span>
        <span>Сделано для друзей и машин, которые нам нравятся</span>
      </small>
    </footer>
  );
}

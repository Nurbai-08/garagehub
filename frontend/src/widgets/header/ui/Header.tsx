import { LogOut, Menu, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { BrandMark } from "@/shared/ui/BrandMark";

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, logout, isRestoring } = useAuth();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className={location.pathname === "/" ? "header" : "header solid"}>
      <a className="skip-link" href="#main-content">
        Перейти к содержанию
      </a>
      <Link to="/" className="brand" aria-label="Гараж — главная">
        <BrandMark />
        гараж
      </Link>
      <nav
        id="main-navigation"
        className={open ? "nav open" : "nav"}
        aria-label="Основная навигация"
      >
        <NavLink to="/explore">Машины</NavLink>
        <NavLink to="/feed">Лента</NavLink>
        {user && <NavLink to="/favorites">Избранное</NavLink>}
        {user && <NavLink to="/messages">Сообщения</NavLink>}
        {!isRestoring && (
          <Link to={user ? "/garage" : "/login"} className="mobile-login">
            {user ? "Моя подборка" : "Войти"}
          </Link>
        )}
      </nav>
      <div className="header-actions">
        {isRestoring ? (
          <span className="auth-loading">Загрузка…</span>
        ) : user ? (
          <>
            <Link to={`/users/${user.username}`} className="login">
              @{user.username}
            </Link>
            <button
              className="logout"
              onClick={() => void logout()}
              aria-label="Выйти"
            >
              <LogOut size={17} />
            </button>
          </>
        ) : (
          <Link to="/login" className="login">
            Войти
          </Link>
        )}
        <Link to="/garage/new" className="add">
          <Plus size={17} /> Добавить машину
        </Link>
      </div>
      <button
        className="menu"
        type="button"
        onClick={() => setOpen(!open)}
        aria-controls="main-navigation"
        aria-expanded={open}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}

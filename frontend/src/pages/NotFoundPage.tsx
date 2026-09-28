import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="mt-2 text-muted-foreground">Страница не найдена</p>
      <Link to="/" className="mt-4 inline-block underline">
        Вернуться на главную
      </Link>
    </div>
  );
}
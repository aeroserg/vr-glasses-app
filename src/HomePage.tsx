type HomePageProps = {
  onOpenCamera: () => void;
  onOpenBooks: () => void;
  onOpenMovies: () => void;
};

export default function HomePage({ onOpenCamera, onOpenBooks, onOpenMovies }: HomePageProps) {
  return (
    <div className="home-page">
      <div className="home-menu">
        <button className="home-menu-button" onClick={onOpenCamera}>Очки</button>
        <button className="home-menu-button" onClick={onOpenBooks}>Книги</button>
        <button className="home-menu-button" onClick={onOpenMovies}>Фильмы</button>
      </div>
    </div>
  );
}

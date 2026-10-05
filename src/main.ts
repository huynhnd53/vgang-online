import { Game } from './game';

const canvas = document.getElementById('scene') as HTMLCanvasElement;

try {
  const game = new Game(canvas);
  game.start();
  if (import.meta.env.DEV) (window as unknown as { __vgang: Game }).__vgang = game;
} catch (err) {
  console.error(err);
  document.body.innerHTML =
    '<p style="color:#fff;font-family:system-ui;padding:24px">Không khởi động được game. Trình duyệt cần hỗ trợ WebGL.</p>';
}

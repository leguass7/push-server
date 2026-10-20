import { connect } from "node:net";

const host = process.env.PGHOST ?? "localhost";
const port = Number(process.env.PGPORT ?? 5433);
const maxAttempts = 30;
const delayMs = 1000;

function tryConnect() {
  return new Promise((resolve) => {
    const socket = connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await tryConnect()) {
      console.log(`[wait-for-postgres] ${host}:${port} aceitando conexões.`);
      return;
    }
    console.log(`[wait-for-postgres] tentativa ${attempt}/${maxAttempts} — aguardando ${host}:${port}...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.error(`[wait-for-postgres] desisti após ${maxAttempts} tentativas.`);
  process.exit(1);
}

main();

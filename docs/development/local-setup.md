# Running the website locally

## 1. Open the project and put Node on your path
```bash
cd ~/github/portfolio
export PATH=$HOME/.local/node/bin:$PATH
```
Node is installed in `~/.local/node`, not system-wide. Run this once and the `export` is permanent:
```bash
echo 'export PATH=$HOME/.local/node/bin:$PATH' >> ~/.bashrc && source ~/.bashrc
```

## 2. Start the server, either way

**Development** (auto-refreshes as you edit files):
```bash
npm run dev
```

**Production** (the fast, final version):
```bash
npm run build && npm start
```

Then open **http://localhost:3000**. Press **Ctrl+C** to stop.

## If port 3000 is busy
```bash
kill $(lsof -t -i:3000)   # stop whatever is using it
npm start -- -p 3001      # or run on another port
```

## First time on a new machine
```bash
npm install
cp .env.example .env.local   # optional: site URL, contact webhook
```

## Checks before committing
```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Git (pushes go to the thisz-akj account)
```bash
git add -A && git commit -m "your message" && git push
```
The remote uses the `github-personal` SSH alias, so it never pushes to the work account.

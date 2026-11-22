# Konik Connect

Konik Connect is the web and mobile experience for managing your device experience.

Try it out at https://connect.konik.ai

## Development

`./live.sh` is probably all you want to use (it'll take care of setup).

For a full fresh setup in `$HOME`:
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or source ~/.zshrc

cd ~
git clone https://github.com/martinl/openpilot-frontend.git connect
bun install  # sets up pre-commit hook
bun dev
```

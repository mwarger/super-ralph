import path from 'path';
import fs from 'fs';

export const SuperRalphPlugin = async ({ client, directory }) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      const configPath = path.join(directory, '.ralph-tui', 'config.toml');
      const isInitialized = fs.existsSync(configPath);

      const message = isInitialized
        ? 'This project uses the super-ralph SDLC pipeline. Use the superpowers-intake skill for PRD generation and superpowers-create-beads for bead conversion. Read .super-ralph/AGENTS.md for framework instructions.'
        : 'The super-ralph SDLC framework is available. Run /super-ralph-init or say "initialize this project for super-ralph" to set up this project.';

      (output.system ||= []).push(message);
    }
  };
};

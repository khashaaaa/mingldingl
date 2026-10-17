import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/pirata-one/400.css';
import '@fontsource/yeseva-one/400.css';
import '../design/tokens.css';
import '../design/base.css';
import './guild.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GuildPage } from './GuildPage';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <GuildPage />
  </StrictMode>,
);

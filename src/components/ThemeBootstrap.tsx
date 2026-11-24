import { THEME_STORAGE_KEY } from '@/lib/theme';

const bootstrapScript = `try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var v=p==='light'||p==='dark'?p:'system';var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=v==='system'?(d?'dark':'light'):v;var e=document.documentElement;e.dataset.theme=t;e.dataset.themePreference=v;}catch(e){}`;

export function ThemeBootstrap({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: bootstrapScript }}
    />
  );
}

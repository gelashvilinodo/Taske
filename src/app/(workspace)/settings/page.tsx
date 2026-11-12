import ThemeSetting from '@/components/settings/ThemeSetting';

export const metadata = { title: 'Settings · Personal Schedule' };

export default function SettingsPage() {
  return (
    <div className="settings">
      <section className="panel settings-group" aria-labelledby="set-appearance">
        <h2 id="set-appearance">Appearance</h2>
        <ThemeSetting />
      </section>
    </div>
  );
}

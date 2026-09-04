import type { ReadingPreferences } from '../app/readingPreferences';
import { Icon } from './Icon';

interface Props {
  preferences: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
  onReset: () => void;
  onFocus: () => void;
}

export function ReadingToolbar({ preferences, onChange, onReset, onFocus }: Props) {
  return (
    <section className="reading-toolbar" aria-label="ابزارهای خواندن">
      <div className="reading-controls">
        <div className="font-control" role="group" aria-label="اندازهٔ متن" dir="ltr">
          <button
            className="icon-button"
            type="button"
            aria-label="کوچک کردن متن"
            title="کوچک کردن متن"
            disabled={preferences.fontSize <= 14}
            onClick={() => onChange({ fontSize: preferences.fontSize - 1 })}
          >
            <span aria-hidden="true">A−</span>
          </button>
          <span className="font-value">
            {preferences.fontSize}
            <small>px</small>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="بزرگ کردن متن"
            title="بزرگ کردن متن"
            disabled={preferences.fontSize >= 28}
            onClick={() => onChange({ fontSize: preferences.fontSize + 1 })}
          >
            <span aria-hidden="true">A+</span>
          </button>
        </div>
        <label className="reading-select">
          <span>فاصلهٔ خطوط</span>
          <select
            value={preferences.lineHeight}
            onChange={(event) => onChange({ lineHeight: Number(event.target.value) })}
          >
            <option value="1.6">فشرده</option>
            <option value="1.9">راحت</option>
            <option value="2.2">باز</option>
          </select>
        </label>
        <label className="reading-select">
          <span>عرض متن</span>
          <select
            value={preferences.width}
            onChange={(event) => onChange({ width: Number(event.target.value) })}
          >
            <option value="38">باریک</option>
            <option value="48">متعادل</option>
            <option value="60">عریض</option>
          </select>
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="بازنشانی تنظیمات خواندن"
          title="بازنشانی تنظیمات خواندن"
          onClick={onReset}
        >
          <Icon name="reset" />
        </button>
      </div>
      <button className="button button-quiet focus-toggle" type="button" onClick={onFocus}>
        <Icon name="focus" />
        حالت تمرکز
      </button>
    </section>
  );
}

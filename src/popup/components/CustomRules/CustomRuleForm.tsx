import React from 'react';

interface CustomRuleFormProps {
  value: string;
  error: string;
  durationMinutes: number;
  durationOptions: { label: string; value: number }[];
  onChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onSubmit: () => void;
}

const CustomRuleForm: React.FC<CustomRuleFormProps> = ({
  value,
  error,
  durationMinutes,
  durationOptions,
  onChange,
  onDurationChange,
  onSubmit
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="custom-site">
            Website to block
          </label>
          <input
            id="custom-site"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="e.g. x.com or youtube.com/shorts"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="block-duration">
            Block duration
          </label>
          <select
            id="block-duration"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full px-3 py-2 bg-primary-500 text-white rounded-md text-sm font-semibold hover:bg-primary-600 active:scale-[0.98] transition-all"
        >
          Add to blocklist
        </button>
      </form>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
    </>
  );
};

export default CustomRuleForm;

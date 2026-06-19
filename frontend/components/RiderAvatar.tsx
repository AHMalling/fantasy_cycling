"use client";

interface Props {
  name: string;
  photoUrl: string;
  size?: number;
}

export default function RiderAvatar({ name, photoUrl, size = 28 }: Props) {
  if (!photoUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full shrink-0 bg-gray-200 dark:bg-gray-700"
        onMouseEnter={() => window.dispatchEvent(new CustomEvent("rider-photo-needed"))}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover object-top shrink-0 bg-gray-100 dark:bg-gray-800"
      style={{ width: size, height: size }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

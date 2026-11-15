import type React from 'react';

export function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = '',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`.trim()}>{children}</span>;
}

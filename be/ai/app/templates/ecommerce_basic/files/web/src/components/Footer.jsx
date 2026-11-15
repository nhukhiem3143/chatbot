import React from 'react';
import tokens from '../theme/tokens.json';

export default function Footer() {
  return <footer className="footer">© {new Date().getFullYear()} {tokens.siteName} — {tokens.tagline}</footer>;
}

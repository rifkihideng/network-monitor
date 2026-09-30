"use client";

import { useEffect, useState } from "react";

interface User {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) {
    return (
      <a className="nav-login" href="/login">
        Login
      </a>
    );
  }
  return (
    <div className="nav-user">
      {user.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" width={24} height={24} className="avatar" />
      )}
      <span>{user.name ?? user.login}</span>
      <a className="nav-logout" href="/api/auth/logout">
        Logout
      </a>
    </div>
  );
}

"use client";
import { useState } from "react";
import { Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { Viewer } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { PageHeading } from "./common";

export function SettingsView({
  viewer,
  refresh,
  motion,
  setMotion,
  logout,
}: {
  viewer: Viewer;
  refresh: () => Promise<void>;
  motion: boolean;
  setMotion: (v: boolean) => void;
  logout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="설정"
        description="우리 아지트에서 조금 더 편안하게."
      />
      <div className="settings-layout">
        <section className="settings-panel">
          <h2>내 프로필</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await api(
                  "/profile",
                  {
                    chatNickname: f.get("chatNickname"),
                    lolNickname: f.get("lolNickname"),
                  },
                  "PATCH",
                );
                await refresh();
                toast.success("프로필을 저장했어요.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              톡방 닉네임
              <input
                name="chatNickname"
                required
                maxLength={24}
                defaultValue={viewer.chatNickname}
              />
            </label>
            <label>
              게임 닉네임
              <input
                name="lolNickname"
                required
                maxLength={40}
                defaultValue={viewer.lolNickname}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" disabled={busy}>
              변경사항 저장 <Check size={16} />
            </button>
          </form>
        </section>
        <section className="settings-panel">
          <h2>내게 맞는 아지트</h2>
          <div className="setting-row">
            <label htmlFor="motion">
              <b>핑 애니메이션</b>
              <span>작은 파동과 빛으로 마음을 전해요.</span>
            </label>
            <Switch id="motion" checked={motion} onCheckedChange={setMotion} />
          </div>
          <p className="muted">기기의 동작 줄이기 설정도 함께 적용됩니다.</p>
          <PasswordForm />
          <button className="text-button logout-button" onClick={logout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </section>
      </div>
    </>
  );
}
function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="password-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setError("");
        try {
          if (f.get("password") !== f.get("confirm"))
            throw new Error("새 비밀번호가 서로 달라요.");
          await api("/auth/password", {
            currentPassword: f.get("current"),
            password: f.get("password"),
          });
          form.reset();
          toast.success(
            "비밀번호를 변경했어요. 다른 기기에서는 로그아웃됩니다.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>비밀번호 변경</h2>
      <label>
        현재 비밀번호
        <input
          type="password"
          name="current"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        새 비밀번호
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={64}
          required
        />
      </label>
      <label>
        새 비밀번호 확인
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={10}
          maxLength={64}
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="secondary-button" disabled={busy}>
        비밀번호 변경
      </button>
    </form>
  );
}

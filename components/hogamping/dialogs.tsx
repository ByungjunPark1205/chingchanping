"use client";
import { useState } from "react";
import { Check, Eye, EyeOff, Flag, ThumbsUp, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { categories, categoryLabel, type Member, type Ping } from "@/lib/types";
import { Avatar, PingMark, PingIcon } from "./visuals";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function AuthDialog({
  mode,
  setMode,
  onSuccess,
}: {
  mode: "login" | "register" | null;
  setMode: (v: "login" | "register" | null) => void;
  onSuccess: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/auth/${mode}`, {
        chatNickname: form.get("chatNickname"),
        password: form.get("password"),
        remember,
      });
      await onSuccess();
      toast.success(
        mode === "register"
          ? "가입 신청을 접수했어요. 운영자 승인 후 활동할 수 있어요."
          : "로그인했어요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!mode}
      onOpenChange={(open) => {
        if (!open && !busy) setMode(null);
      }}
    >
      <DialogContent className="hogam-dialog auth-dialog">
        <PingMark />
        <DialogTitle>
          {mode === "register"
            ? "가입 신청"
            : "로그인"}
        </DialogTitle>
        <DialogDescription>
          {mode === "register"
            ? "톡방 닉네임과 비밀번호를 입력해주세요. 운영자 승인 후 활동할 수 있어요."
            : "가입할 때 사용한 닉네임과 비밀번호를 입력해주세요."}
        </DialogDescription>
        <form onSubmit={submit} key={mode}>
          <label>
            톡방 닉네임
            <input
              name="chatNickname"
              autoComplete="username"
              required
              maxLength={24}
              placeholder="톡방에서 사용하는 닉네임"
            />
          </label>
          <label>
            비밀번호
            <span className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                aria-label="비밀번호"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                required
                minLength={10}
                maxLength={64}
                placeholder="10자 이상 입력해주세요"
              />
              <button
                type="button"
                className="password-visibility"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {mode !== "register" && (
            <label className="check-label">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              로그인 유지
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full" disabled={busy}>
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <PingIcon size={18} />
            )}{" "}
            {mode === "register" ? "가입 신청하기" : "로그인하기"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "계정이 없나요? 가입하기"
            : "이미 가입했나요? 로그인하기"}
        </button>
        <p className="auth-notice">
          <LockKeyhole size={13} />
          칭찬 작성자는 다른 회원에게 공개되지 않아요.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function ComposeDialog({
  member,
  onClose,
  onSuccess,
}: {
  member: Member | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [phase, setPhase] = useState("writing");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setPhase("sending");
    setError("");
    try {
      await new Promise((r) => setTimeout(r, 700));
      await api("/compliments", { receiverId: member.id, message, category });
      setPhase("success");
      await onSuccess();
    } catch (e) {
      setPhase("writing");
      setError((e as Error).message);
    }
  }
  return (
    <Dialog
      open={!!member}
      onOpenChange={(open) => {
        if (!open && phase !== "sending") onClose();
      }}
    >
      <DialogContent
        className="hogam-dialog compose-dialog"
        showCloseButton={phase !== "sending"}
      >
        {phase === "success" ? (
          <>
            <div className="success-orbit">
              <PingMark animate />
              <Check size={23} />
            </div>
            <DialogTitle className="center">칭찬을 보냈어요</DialogTitle>
            <DialogDescription className="center">
              {member?.chatNickname}님에게 칭찬핑을 보냈어요.
            </DialogDescription>
            <button className="primary-button full" onClick={onClose}>
              확인 <ThumbsUp size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="compose-person">
              <Avatar
                name={member?.chatNickname ?? ""}
                index={member?.avatar}
                large
              />
              <div className="eyebrow">받는 사람</div>
            </div>
            <DialogTitle>
              {member?.chatNickname}님에게 칭찬핑 보내기
            </DialogTitle>
            <DialogDescription>
              어떤 행동이 좋았는지 구체적으로 적어주세요.
            </DialogDescription>
            <form onSubmit={submit}>
              <div className="category-picker">
                <p id="category-label">어떤 점을 칭찬할까요?</p>
                <RadioGroup
                  value={category}
                  onValueChange={setCategory}
                  aria-labelledby="category-label"
                  className="category-options"
                >
                  {categories.map((c, i) => (
                    <label
                      htmlFor={`category-${i}`}
                      className={category === c ? "selected" : ""}
                      key={c}
                    >
                      <RadioGroupItem id={`category-${i}`} value={c} />
                      {categoryLabel(c)}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <label className="sr-only" htmlFor="ping-message">
                칭찬 메시지
              </label>
              <textarea
                id="ping-message"
                required
                minLength={5}
                maxLength={300}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="예: 처음 하는 게임이었는데 진행 방법을 차근차근 알려줘서 고마웠어요."
                disabled={phase === "sending"}
              />
              <div className="textarea-footer">
                <span>
                  <LockKeyhole size={12} />
                  칭찬은 익명으로 전달돼요
                </span>
                <span>{message.length} / 300</span>
              </div>
              <p className="form-hint">수신자가 신고하면 관리자에게만 작성자가 표시돼요.</p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className={`primary-button full ${phase === "sending" ? "sending-button" : ""}`}
                disabled={phase === "sending" || message.trim().length < 5}
              >
                {phase === "sending" ? (
                  <PingMark animate />
                ) : (
                  <PingIcon size={18} />
                )}{" "}
                {phase === "sending" ? "보내는 중…" : "칭찬핑 보내기"}
              </button>
              <p className="form-hint">
                한 사람에게 하루 3번 · 전체 하루 10번까지
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({
  ping,
  onClose,
}: {
  ping: Ping | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open={!!ping}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="hogam-dialog">
        <DialogTitle>이 칭찬핑을 신고할까요?</DialogTitle>
        <DialogDescription>
          신고 사유와 메시지가 관리자에게 전달됩니다. 작성자는 관리자에게만 표시되며, 신고한 회원에게는 공개되지 않아요.
        </DialogDescription>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/reports", { complimentId: ping?.id, reason });
              toast.success("신고를 접수했어요. 운영자가 확인할게요.");
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            신고 사유
            <textarea
              required
              minLength={5}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="욕설, 비꼬는 말 등 불편했던 내용을 적어주세요."
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Flag size={17} />}
            운영자에게 보내기
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

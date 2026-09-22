"use client";
import { useEffect, useState } from "react";
import { Check, Flag, ThumbsUp, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { categories, type Member, type Ping } from "@/lib/types";
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
  useEffect(() => setError(""), [mode]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (mode === "register" && form.get("password") !== form.get("confirm"))
        throw new Error("비밀번호가 서로 달라요. 다시 확인해주세요.");
      await api(`/auth/${mode}`, {
        chatNickname: form.get("chatNickname"),
        lolNickname: form.get("lolNickname"),
        password: form.get("password"),
        remember,
      });
      await onSuccess();
      toast.success(
        mode === "register"
          ? "칭찬핑 탐지 준비 완료."
          : "다시 만나서 반가워요!",
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
            ? "내 핑을 등록해볼까요?"
            : "우리 아지트에 오신 걸 환영해요"}
        </DialogTitle>
        <DialogDescription>
          {mode === "register"
            ? "우리 커뮤니티에서 사용하는 닉네임으로 등록하세요."
            : "우리 커뮤니티에 도착한 칭찬을 확인해보세요."}
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
          {mode === "register" && (
            <label>
              게임 닉네임
              <input
                name="lolNickname"
                required
                maxLength={40}
                placeholder="게임에서 사용하는 닉네임"
              />
            </label>
          )}
          <label>
            비밀번호
            <input
              type="password"
              name="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
              minLength={10}
              maxLength={64}
              placeholder="10자 이상 입력해주세요"
            />
          </label>
          {mode === "register" ? (
            <label>
              비밀번호 확인
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={64}
                placeholder="비밀번호를 한 번 더 입력해주세요"
              />
            </label>
          ) : (
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
            {mode === "register" ? "칭찬핑 등록하기" : "로그인하기"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "처음 오셨나요? 내 핑 등록하기"
            : "이미 등록했나요? 로그인하기"}
        </button>
        <p className="auth-notice">
          <LockKeyhole size={13} />
          칭찬을 보내는 당신의 이름은 공개되지 않아요.
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
  useEffect(() => {
    setMessage("");
    setPhase("writing");
    setError("");
    setCategory(categories[0]);
  }, [member?.id]);
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
            <DialogTitle className="center">칭찬핑 전송 완료!</DialogTitle>
            <DialogDescription className="center">
              {member?.chatNickname}님에게 칭찬핑을 보냈어요.
              <br />
              당신이 발견한 좋은 행동이 칭찬으로 전해졌어요.
            </DialogDescription>
            <button className="primary-button full" onClick={onClose}>
              핑 찍었습니다. <ThumbsUp size={17} />
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
              <div className="eyebrow">좋은 행동을 발견한 순간</div>
            </div>
            <DialogTitle>
              {member?.chatNickname}님에게 칭찬핑 보내기
            </DialogTitle>
            <DialogDescription>
              이 사람이 했던 좋은 행동을 남겨주세요.
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
                      {c}
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
                placeholder="처음 들어왔을 때 먼저 게임 같이 하자고 해줘서 고마웠어요 :)"
                disabled={phase === "sending"}
              />
              <div className="textarea-footer">
                <span>
                  <LockKeyhole size={12} />
                  칭찬은 익명으로 전달돼요
                </span>
                <span>{message.length} / 300</span>
              </div>
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
                {phase === "sending" ? "칭찬을 전하는 중…" : "칭찬핑 보내기"}
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
  useEffect(() => {
    setReason("");
    setError("");
  }, [ping?.id]);
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
          불편했던 이유를 알려주세요. 운영자가 확인합니다.
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

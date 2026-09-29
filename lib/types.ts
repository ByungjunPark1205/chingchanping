export type Member = {
  id: string;
  chatNickname: string;
  lolNickname: string;
  avatar: number;
  count: number;
};
export type Viewer = Member & { role: "member" | "admin"; unread: number; approvalStatus: "pending" | "approved" };
export type Ping = {
  id: string;
  message: string;
  createdAt: number;
  receiver: Member;
  isNew?: boolean;
  category: string;
  likes: number;
  liked: boolean;
  weeklyLikes: number;
};
export type Page =
  | "home"
  | "send"
  | "received"
  | "profile"
  | "settings"
  | "admin"
  | "notfound";
export const categories = [
  "함께해서 즐거워요",
  "따뜻하게 챙겨줘요",
  "매너가 좋아요",
  "힘이 되어줘요",
];

// Keep stored category values stable so existing compliments remain compatible.
const categoryLabels: Record<string, string> = {
  "함께해서 즐거워요": "함께해서 즐거웠어요",
  "따뜻하게 챙겨줘요": "잘 챙겨줬어요",
  "매너가 좋아요": "매너가 좋아요",
  "힘이 되어줘요": "도움이 됐어요",
};

export function categoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}

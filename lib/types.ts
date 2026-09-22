export type Member = {
  id: string;
  chatNickname: string;
  lolNickname: string;
  avatar: number;
  count: number;
};
export type Viewer = Member & { role: "member" | "admin"; unread: number };
export type Ping = {
  id: string;
  message: string;
  createdAt: number;
  receiver: Member;
  isNew?: boolean;
  category: string;
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

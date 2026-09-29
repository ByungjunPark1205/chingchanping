import type { Member, Ping } from "./types";
const names = ["A", "B", "C", "D", "E", "F"].map((name) => [
  name,
  `PLAYER ${name}`,
]);
export const exampleMembers: Member[] = names.map(
  ([chatNickname, lolNickname], i) => ({
    id: `example-${i}`,
    chatNickname,
    lolNickname,
    avatar: i,
    count: 0,
  }),
);
const messages = [
  "처음 참여했을 때 먼저 게임에 초대해줘서 고마웠어요.",
  "게임은 졌지만 끝까지 같이 해줘서 재밌었어요.",
  "실수했을 때 다음에 어떻게 하면 되는지 알려줘서 도움이 됐어요.",
  "처음 하는 게임이었는데 진행 방법을 차근차근 알려줘서 고마웠어요.",
  "새로 온 사람에게 먼저 인사하고 말을 걸어줘서 좋았어요.",
  "의견이 갈렸을 때 양쪽 이야기를 듣고 정리해줘서 고마웠어요.",
];
export const examplePings: Ping[] = exampleMembers.map((receiver, i) => ({
  id: `example-ping-${i}`,
  receiver,
  message: messages[i],
  createdAt: 0,
  likes: 0,
  liked: false,
  weeklyLikes: 0,
  category: [
    "따뜻하게 챙겨줘요",
    "함께해서 즐거워요",
    "힘이 되어줘요",
    "따뜻하게 챙겨줘요",
    "매너가 좋아요",
    "함께해서 즐거워요",
  ][i],
}));

import type { Member, Ping } from "./types";
const names = [
  ["곰고미", "GOMGOMI#KR1"],
  ["소소", "soso#KR1"],
  ["달빛산책", "Moon walk#0824"],
  ["포로로", "PORORO#KR1"],
  ["민트초코", "mint choco#0301"],
  ["정글의온도", "warm jungle#KR1"],
];
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
  "처음 들어왔을 때 먼저 같이 게임하자고 해줘서 고마웠어요. 덕분에 금방 친해졌어요 :)",
  "게임은 졌지만 같이해서 진짜 재밌었어요. 다음에도 우리 팀 해요!",
  "실수해도 괜찮다고 해주는 한마디가 생각보다 큰 힘이 됐어요. 고마워요!",
  "뉴비 질문에도 하나하나 알려주는 우리 방 설명 요정. 늘 고마워요!",
  "먼저 인사해주고 말 걸어줘서 어색하지 않았어요. 덕분에 잘 적응 중이에요.",
  "분위기 안 좋을 때 웃게 만들어주는 사람. 오늘도 덕분에 즐겜했어요!",
];
export const examplePings: Ping[] = exampleMembers.map((receiver, i) => ({
  id: `example-ping-${i}`,
  receiver,
  message: messages[i],
  createdAt: 0,
  category: [
    "따뜻하게 챙겨줘요",
    "함께해서 즐거워요",
    "힘이 되어줘요",
    "따뜻하게 챙겨줘요",
    "매너가 좋아요",
    "함께해서 즐거워요",
  ][i],
}));

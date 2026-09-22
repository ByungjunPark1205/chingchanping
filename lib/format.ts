export const time = (stamp: number) => {
  const minutes = Math.floor((Date.now() - stamp) / 60000);
  return minutes < 1
    ? "방금 전"
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : new Date(stamp).toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
          });
};

export type AdminUser = {
  id: string;
  chatNickname: string;
  lolNickname: string;
  createdAt: number;
  isActive: number;
  approvalStatus: "pending" | "approved";
  mergedInto: string | null;
  mergedNickname: string | null;
  role: "member" | "admin";
  receivedCount: number;
  sentCount: number;
};
export type ManagedMember = Omit<AdminUser, "sentCount">;

export type MergePreview = {
  source: AdminUser;
  target: AdminUser;
  likes: number;
  duplicateLikes: number;
  reports: number;
  betweenCompliments: number;
};

export type MemberAction = {
  id: string;
  action: "approve" | "remove" | "restore" | "merge";
  actor: string;
  sourceNickname: string;
  targetNickname: string | null;
  createdAt: number;
};

import { api } from "./client";

export type HouseholdRole = "owner" | "admin" | "member" | "viewer";

export interface HouseholdMember {
  id: number;
  user_id: number;
  role: HouseholdRole;
  joined_at: string;
  email: string | null; 
}

export interface Invitation {
  id: number;
  email: string;
  role: HouseholdRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationCreate {
  email: string;
  role: "admin" | "member" | "viewer";
}

export const membersApi = {
  list: (householdId: number) =>
    api.get<HouseholdMember[]>(`/households/${householdId}/members`),

  updateRole: (householdId: number, userId: number, role: HouseholdRole) =>
    api.patch<HouseholdMember>(
      `/households/${householdId}/members/${userId}`,
      { role },
    ),

  remove: (householdId: number, userId: number) =>
    api.delete(`/households/${householdId}/members/${userId}`),
};

export const invitationsApi = {
  list: (householdId: number) =>
    api.get<Invitation[]>(`/households/${householdId}/invitations`),

  create: (householdId: number, data: InvitationCreate) =>
    api.post<Invitation>(`/households/${householdId}/invitations`, data),

  accept: (token: string) =>
    api.post(`/households/invitations/${token}/accept`),
};
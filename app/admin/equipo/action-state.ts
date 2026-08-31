export type TeamActionState = Readonly<{
  error: string;
  success: string;
  field?: string;
}>;

export const initialTeamActionState: TeamActionState = {
  error: "",
  success: "",
};

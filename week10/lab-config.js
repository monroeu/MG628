// MG628 lab configuration.
window.LAB_CONFIG = {
  lab: {
    id: "forecasting",            // used to keep this lab's records separate in the mg628_ tables
    week: "Week 10",
    title: "Forecasting with Time Series Data"
  },

  // The Monroe participation Supabase project (same as every MG628 week).
  supabaseUrl: "https://irnrjzeejalbbqdrbzmj.supabase.co",
  supabaseAnonKey: "sb_publishable_aj2vpjfJrSMvjTxcKuC0pQ_pf7JbDo2",

  // Optional but recommended: the ID of this week's participation assignment in the Instructor Control Center.
  // When set, only students in a section where that assignment is published are recorded, a participation
  // session is opened for them, and their active study time is recorded centrally like Weeks 5-7.
  // Leave "" to accept any student on an MG628 roster instead.
  participationAssignmentId: "",

  // Shown in the privacy notice students see before signing in.
  instructorName: "Professor Kassoh",
  privacyContact: ""
};

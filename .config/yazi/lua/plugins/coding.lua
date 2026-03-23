return {
  -- Incremental rename
  {
    "smjonas/inc-rename.nvim",
    cmd = "IncRename",
    config = true,
  },
  {
    "David-Kunz/gen.nvim",
    opts = {
      model = "llama3.2", -- Match your local pull
      host = "localhost",
      port = "11434",
    },
  },
}

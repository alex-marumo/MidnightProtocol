-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")

return {
  "kdheepak/lazygit.nvim",
  cmd = {
    "LazyGit",
    "LazyGitConfig",
    "LazyGitCurrentFile",
    "LazyGitFilter",
    "LazyGitFilterCurrentFile",
  },
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    -- Summon LazyGit with Space + g + g
    { "<leader>gg", "<cmd>LazyGit<cr>", desc = "LazyGit" },
  },
}

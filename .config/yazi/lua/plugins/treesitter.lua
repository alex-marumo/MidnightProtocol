return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    event = { "BufReadPost", "BufNewFile" },
    opts = {
      ensure_installed = {
        "astro",
        "cmake",
        "cpp",
        "css",
        "fish",
        "gitignore",
        "go",
        "graphql",
        "http",
        "java",
        "php",
        "rust",
        "scss",
        "sql",
        "svelte",
        "lua",
        "javascript",
        "typescript",
        "html",
        "markdown",
        "markdown_inLine",
      },
      highlight = { enable = true },
      indent = { enable = true },
    },
    config = function(_, opts)
      vim.defer_fn(function()
        local ok, config = pcall(require, "nvim-treesitter.config")
        if not ok then
          vim.notify("Failed to load nvim-treesitter.config", vim.log.levels.ERROR)
          return
        end
        config.setup(opts)
        require("nvim-treesitter.config").setup(opts)

        -- MDX support
        vim.filetype.add({ extension = { mdx = "mdx" } })
        vim.treesitter.language.register("markdown", "mdx")
      end, 100)
    end,
  },
}

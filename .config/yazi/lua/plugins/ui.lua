return {
  "folke/noice.nvim",

  -- remove the no information available notifications
  opts = function(_, opts)
    table.insert(opts.routes, {
      filter = {
        event = "notify",
        find = "No information available",
      },
      opts = { skip = true },
    })

    -- add border to notifications
    opts.presets.lsp_doc_border = true
  end,

  -- notification timeouts
  {
    "rcarriga/nvim-notify",
    opts = {
      timeout = 10000,
    },
  },
  -- bufferline
  {
    "akinsho/bufferline.nvim",
    event = "VeryLazy",
    keys = {
      { "<Tab>", "<Cmd>BufferLineCycleNext<CR>", desc = "Next tab" },
      { "<S-Tab>", "<Cmd>BufferLineCyclePrev<CR>", desc = "Prev tab" },
    },
    opts = {
      options = {
        mode = "tabs",
        separator_style = "slant",
        show_buffer_close_icons = true,
        show_close_icon = false,
      },
    },
  },
  -- filename
  {
    "b0o/incline.nvim",
    dependencies = { "craftzdog/solarized-osaka.nvim" },
    event = "BufReadPre",
    priority = 1200,
    config = function()
      local colors = require("solarized-osaka.colors").setup()
      require("incline").setup({
        highlight = {
          groups = {
            InclineNormal = { guibg = colors.magenta500, guifg = colors.base04 },
            InclineNormalNC = { guifg = colors.violet500, guibg = colors.base03 },
          },
        },
        window = { margin = { vertical = 0, horizontal = 1 } },
        hide = {
          cursorline = true,
        },
        render = function(props)
          local filename = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(props.buf), ":t")
          if vim.bo[props.buf].modified then
            filename = "[+] " .. filename
          end

          local icon, color = require("nvim-web-devicons").get_icon_color(filename)
          return { { icon, guifg = color }, { " " }, { filename } }
        end,
      })
    end,
  },
  -- statusline
  {
    "nvim-lualine/lualine.nvim",
    opts = function(_, opts)
      local LazyVim = require("lazyvim.util")
      opts.sections.lualine_c[4] = {
        LazyVim.lualine.pretty_path({
          length = 0,
          relative = "cwd",
          modified_hl = "MatchParen",
          directory_hl = "",
          filename_hl = "Bold",
          modified_sign = "",
          readonly_icon = " 󰌾 ",
        }),
      }
    end,
  },
  {
    "folke/zen-mode.nvim",
    cmd = "ZenMode",
    opts = {
      plugins = {
        gitsigns = true,
        tmux = true,
        kitty = { enabled = false, font = "+2" },
      },
    },
    keys = { { "<leader>z", "<cmd>ZenMode<cr>", desc = "Zen Mode" } },
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    enabled = false,
  },
  {
    "folke/snacks.nvim",
    opts = {
      dashboard = {
        preset = {
          header = [[

  dBBBBBb    dBBBBb dBP dBP.dBBBBP.dBBBBP   dBPdBPdBP dBBBBBb     dBP    dBP dBP dBBBP dBBBBBb
       BB       dBP    dBP BP     BP                       BB           d8P.dBP            dBP
   dBP BB   dBBBK'    dBP  `BBBBb `BBBBb  dBPdBPdBP    dBP BB   dBP    dBBBBP  dBBP    dBBBBK 
  dBP  BB  dB' db    dBP      dBP    dBP dBPdBPdBP    dBP  BB  dBP    dBP BB  dBP     dBP  BB 
 dBBBBBBB dBBBBP'   dBP  dBBBBP'dBBBBP' dBBBBBBBP    dBBBBBBB dBBBBP dBP dBP dBBBBP  dBP  dB' 
                                                                                              

         ]],
        },
      },
    },
  },
}

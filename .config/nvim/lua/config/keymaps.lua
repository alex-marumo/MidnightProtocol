-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
--
-- Toggle NvimTree
vim.keymap.set("n", "<C-n>", ":NvimTreeToggle<CR>", { silent = true, desc = "Toggle NvimTree" })

-- Focus NvimTree (if already open)
vim.keymap.set("n", "<leader>e", ":NvimTreeFocus", { silent = true, desc = "Focus NvimTree" })

-- Open a new tab page
vim.keymap.set("n", "<leader>tn", ":tabnew<CR>", { desc = "New Tab" })
-- Close the current tab page
vim.keymap.set("n", "<leader>tc", ":tabclose<CR>", { desc = "Close Tab" })
-- Open the current buffer in a new tab (Zoom in)
vim.keymap.set("n", "<leader>to", ":tabedit %<CR>", { desc = "Open current buffer in new tab" })

-- Save files
vim.keymap.set("n", "<leader>w", ":wall <CR>", opts)

-- Split window
vim.keymap.set("n", "<leader>wv", "<C-w>v", { desc = "Split window vertically" })
vim.keymap.set("n", "<leader>wcs", "<C-w>s", { desc = "Split window horizontally" })

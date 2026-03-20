import app from "ags/gtk4/app"
import style from "./style.scss"
import Sidebar from "./widget/Sidebar"
import OSD from "./widget/Osd"
import ControlCenter from "./widget/ControlCenter"
import ControlCenterToggle from "./widget/ControlCenterToggle"
import Launcher from "./widget/launcher/launcher" 
import CheatSheet from "./widget/Cheatsheet"

app.start({
  css: style,

  main() {
    app.get_monitors().forEach((monitor) => {
      app.add_window(Sidebar(monitor))
    })

    const globalWindows = [
      Launcher(),
      ControlCenter(),
      ControlCenterToggle(),
      OSD(),
      CheatSheet(),
    ]
    globalWindows.forEach(win => app.add_window(win))
  },
})
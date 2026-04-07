import app from "ags/gtk4/app"
import style from "./style.scss"
import Sidebar from "./widgets/Sidebar"
import OSD from "./widgets/Osd"
import ControlCenter from "./widgets/ControlCenter"
import ControlCenterToggle from "./widgets/ControlCenterToggle"
import Launcher from "./widgets/launcher/launcher" 
import CheatSheet from "./widgets/Cheatsheet"

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
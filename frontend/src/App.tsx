import { Canvas } from './components/canvas/Canvas'
import { ChatPanel } from './components/chat/ChatPanel'
import './index.css'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <ChatPanel />
      <Canvas />
    </div>
  )
}

export default App
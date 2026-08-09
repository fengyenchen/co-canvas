import { Canvas } from './components/canvas/Canvas'
import { ChatPanel } from './components/chat/ChatPanel'
import './index.css'

function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background lg:flex-row">
      <ChatPanel />
      <Canvas />
    </div>
  )
}

export default App

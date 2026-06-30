import React, { useState, useEffect, useRef } from 'react'
import api, { getErrorMessage } from '../api/axios'

const QUICK_PROMPTS = [
  "Rekomendasi Course HTML",
  "Course Pemula Terpopuler",
  "Rekomendasi Belajar JavaScript"
]

export default function ChatbotPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Halo! Saya adalah AI Asisten Simple LMS. Ada yang bisa saya bantu hari ini? Anda bisa menanyakan rekomendasi course seperti: "Saya mencari Course Belajar HTML, mana yang direkomendasikan?"'
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText.trim()
    if (!text) return

    if (!textToSend) {
      setInputText('')
    }

    // Add user message to state
    setMessages((prev) => [...prev, { sender: 'user', text }])
    setIsLoading(true)

    try {
      const response = await api.post('/chatbot', { message: text })
      setMessages((prev) => [...prev, { sender: 'bot', text: response.data.response }])
    } catch (error) {
      const errMsg = getErrorMessage(error, 'Gagal terhubung dengan asisten chatbot.')
      setMessages((prev) => [...prev, { sender: 'bot', text: `Maaf, terjadi kesalahan: ${errMsg}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleSendMessage()
  }

  // Parse custom format helper (for bold and lists) to render clean HTML safely in React
  const renderMessageContent = (text) => {
    if (!text) return null
    const lines = text.split('\n')
    let insideList = false
    const elements = []

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      
      // Check for bullet point
      const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*')
      
      // Parse Bold (**text**)
      const parseBold = (str) => {
        const boldRegex = /\*\*(.*?)\*\*/g
        const parts = []
        let lastIndex = 0
        let match
        
        while ((match = boldRegex.exec(str)) !== null) {
          if (match.index > lastIndex) {
            parts.push(str.substring(lastIndex, match.index))
          }
          parts.push(<strong key={match.index}>{match[1]}</strong>)
          lastIndex = boldRegex.lastIndex
        }
        
        if (lastIndex < str.length) {
          parts.push(str.substring(lastIndex))
        }
        return parts.length > 0 ? parts : str
      }

      if (isBullet) {
        const contentStr = trimmed.replace(/^[-*]\s+/, '')
        elements.push(
          <li key={idx} style={{ marginLeft: '1rem', listStyleType: 'disc', marginBottom: '0.2rem' }}>
            {parseBold(contentStr)}
          </li>
        )
      } else if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '0.5rem' }} />)
      } else {
        elements.push(
          <p key={idx} style={{ margin: '0.25rem 0' }}>
            {parseBold(line)}
          </p>
        )
      }
    })

    return elements
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        className="chatbot-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title="Tanya Asisten AI"
      >
        {isOpen ? '❌' : '💬'}
      </button>

      {/* Chatbot Window Popup */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <h3><span>🤖</span> LMS AI Assistant</h3>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>×</button>
          </div>

          {/* Messages Area */}
          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chatbot-msg ${msg.sender}`}>
                {renderMessageContent(msg.text)}
              </div>
            ))}
            
            {/* Loading/Typing state */}
            {isLoading && (
              <div className="chatbot-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="chatbot-quick">
            {QUICK_PROMPTS.map((prompt, index) => (
              <button 
                key={index} 
                className="chatbot-quick-btn" 
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form className="chatbot-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="form-control"
              placeholder="Ketik pesan Anda..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="chatbot-send-btn"
              disabled={isLoading || !inputText.trim()}
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </>
  )
}

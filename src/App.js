import './App.css';
import { useMemo } from 'react';
import React, { useRef, useState } from 'react';
import { useEffect } from 'react'; // Import useEffect
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { Button, TextField, Box, Typography } from '@mui/material';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import receivedAudioFile from './Recieved_Notification.mp3';
import sentAudioFile from './Send_Notification.mp3';


firebase.initializeApp({
  apiKey: "AIzaSyBXC1ccQlE2jnSq8FeW91h1oLYUF2p8Vd0",
  authDomain: "livechatdereckrojas.firebaseapp.com",
  projectId: "livechatdereckrojas",
  storageBucket: "livechatdereckrojas.appspot.com",
  messagingSenderId: "778380571048",
  appId: "1:778380571048:web:1bb05748d738d5c1496d9d",
  measurementId: "G-HCTVM0VPBV"
});


const sentAudio = new Audio(sentAudioFile);
const receivedAudio = new Audio(receivedAudioFile);

const auth = firebase.auth();
const firestore = firebase.firestore();

function App() {
  const [user] = useAuthState(auth);
  const [chatType, setChatType] = useState('public');
  const [selectedUser, setSelectedUser] = useState(null);

  const usersRef = firestore.collection('users');
  const [users] = useCollectionData(usersRef, { idField: 'id' });

  const handleSelectUser = (userId) => {
    setSelectedUser(userId);
    setChatType('private');
  };

  const handleEnterGlobalChat = () => {
    setSelectedUser(null);
    setChatType('public');
  };

  
  return (
    <div className="App">
      <div className="sidebar">
        <header>
          <Typography variant="h4" align="center" gutterBottom>
            Live Chat Dereck Rojas
          </Typography>
        </header>
        <section>
          {user ? (
            <>
                  <UserList
                users={users}
                onSelectUser={handleSelectUser}
                onEnterGlobalChat={handleEnterGlobalChat}
                selectedUser={selectedUser}
              />
            </>
          ) : (
            <SignIn usersRef={usersRef} />
          )}
        </section>
      </div>
      <div className="chat-area">
        <header>
          <Typography variant="h6" align="center" gutterBottom>
            {chatType === "public"
              ? "Global Chat"
              : selectedUser
              ? `Private Chat with ${selectedUser}`
              : "Select a User to start a Private Chat"}
          </Typography>
          <Box>
            <SignOut usersRef={usersRef} />
          </Box>
        </header>
        <section>
          {user && (
            <>
              <ChatRoom
                chatType={chatType}
                selectedUser={selectedUser}
              />
                          </>
          )}
        </section>
      </div>
    </div>
  );
}

function SignIn({ usersRef }) {

  const signInWithGoogle = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
  
    if (result.user) {
      const { uid, displayName, photoURL, email } = result.user;
      const userData = {
        uid,
        displayName,
        photoURL,
        email,
        online: true,
      };
  
      const userDocRef = usersRef.doc(uid);
      const userDoc = await userDocRef.get();
  
      if (!userDoc.exists) {
        await userDocRef.set(userData);
      } else {
        await userDocRef.update({ online: true });
      }
    }
  };
  return (
    <>
      <Button variant="contained" color="primary" onClick={signInWithGoogle}>
        Iniciar Sesion con Google
      </Button>
    </>
  );
}


function SignOut({ usersRef }) {
  const handleSignOut = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userDocRef = usersRef.doc(currentUser.uid);
      const userDoc = await userDocRef.get();
  
      if (userDoc.exists) {
        await userDocRef.update({ online: false });
      }
      
      auth.signOut();
    }
  };
  return auth.currentUser && (
    <Button variant="outlined" color="secondary" onClick={handleSignOut}>
      Cerrar Sesion
    </Button>
  );
}

function ChatRoom({ chatType, selectedUser }) {
  const dummy = useRef();
  const messagesRef = firestore.collection('messages');
  const query = messagesRef.orderBy('createdAt');

  const privateMessagesRef = firestore.collection('privateMessages');
  const privateQuery = useMemo(() => {
    if (!selectedUser || !auth.currentUser || !auth.currentUser.uid) {
      return null;
    }
    const chatId = auth.currentUser.uid < selectedUser ? auth.currentUser.uid + '_' + selectedUser : selectedUser + '_' + auth.currentUser.uid;
    return privateMessagesRef
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt');
  }, [selectedUser, privateMessagesRef]);

  const [publicMessages] = useCollectionData(query, { idField: 'id' });
  const [privateMessagesData] = useCollectionData(privateQuery, { idField: 'id' });

  const messages = chatType === 'private' ? privateMessagesData : publicMessages;

  const [formValue, setFormValue] = useState('');

  useEffect(() => {
    if (messages) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.uid !== auth.currentUser.uid) {
        receivedAudio.play();
      }
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
  
    const { uid, photoURL } = auth.currentUser;
  
    const newMessage = {
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
    };

    sentAudio.play();
  
    if (chatType === 'public') {
      await messagesRef.add(newMessage);
    } else {
      const chatId = uid < selectedUser ? uid + '_' + selectedUser : selectedUser + '_' + uid;
      const privateChatRef = privateMessagesRef.doc(chatId);
      const chatSnapshot = await privateChatRef.get();
  
      if (!chatSnapshot.exists) {
        // Create a new private chat document and add the first message
        await privateChatRef.set({
          user1: uid,
          user2: selectedUser,
        });
        await privateChatRef.collection('messages').add(newMessage);
      } else {
        // Add the new message to the existing private chat
        await privateChatRef.collection('messages').add(newMessage);
      }
    }
  
    setFormValue('');
    dummy.current.scrollIntoView({ behavior: 'smooth' });
  };  
    return (
      <div className="chat-area">
      <main className="messages">
        <TransitionGroup>
          {messages &&
            messages.map((msg, index) => (
              <CSSTransition key={msg.id} timeout={300} classNames="message-transition">
                <ChatMessage message={msg} />
              </CSSTransition>
            ))}
        </TransitionGroup>
        <span ref={dummy}></span>
      </main>
  
        <form onSubmit={sendMessage}>
          <Box display="flex" alignItems="center" mt={2} width="100%">
            <TextField
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder="Escribe algo..."
              fullWidth
              margin="dense"
              sx={{ flexGrow: 1 }} // Add flexGrow property here
            />
            <Button
              type="submit"
              color="primary"
              variant="contained"
              disabled={!formValue}
            >
              Enviar
            </Button>
          </Box>
        </form>
      </div>
    );
  }
  

  function UserList({ users, onSelectUser, onEnterGlobalChat, selectedUser }) {
    const currentUser = auth.currentUser;

    return (
      <div className="user-list">
        <Box display="flex" justifyContent="center" mb={2}>
          <Button variant="contained" color="primary" onClick={onEnterGlobalChat}>
            Global Chat
          </Button>
        </Box>
                <h2>Usuarios en línea</h2>
        <ul>
          {users &&
            users
              .filter((user) => user.online && user.uid !== currentUser.uid)
              .map((user) => (
                <li
                  key={user.uid}
                  className={user.uid === selectedUser ? 'selected' : ''}
                  onClick={() => onSelectUser(user.uid)}
                >
                  <img src={user.photoURL} alt={user.displayName} />
                  <span>{user.displayName}</span>
                </li>
              ))}
        </ul>
      </div>
    );
  }



function ChatMessage(props) {
  const { text, uid, photoURL } = props.message;

  const messageClass = uid === auth.currentUser.uid ? 'sent' : 'received';

  return (<>
    <div className={`message ${messageClass}`}>
      <img src={photoURL || 'https://api.adorable.io/avatars/23/abott@adorable.png'} />
      <p>{text}</p>
    </div>
  </>)
}

async function initiatePrivateChat(user1, user2, chatType, selectedUser, messagesRef, newMessage) {
  const privateMessagesRef = firestore.collection('privateMessages');
  const existingChat = await privateMessagesRef
    .where('user1', 'in', [user1, user2])
    .where('user2', 'in', [user1, user2])
    .get();

    if (chatType === 'private' && selectedUser) {
      const newChat = {
        user1: auth.currentUser.uid,
        user2: selectedUser,
        messages: [newMessage],
      };
      console.log(newChat);
      await privateMessagesRef.add(newChat);
    } else {
      await messagesRef.add(newMessage);
    }
}


export default App;

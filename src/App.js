import './App.css';
import { useMemo } from 'react';
import React, { useRef, useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';

firebase.initializeApp({
  apiKey: "AIzaSyBXC1ccQlE2jnSq8FeW91h1oLYUF2p8Vd0",
  authDomain: "livechatdereckrojas.firebaseapp.com",
  projectId: "livechatdereckrojas",
  storageBucket: "livechatdereckrojas.appspot.com",
  messagingSenderId: "778380571048",
  appId: "1:778380571048:web:1bb05748d738d5c1496d9d",
  measurementId: "G-HCTVM0VPBV"
});

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

  return (
    <div className="App">
      <header>
        <h1>Live Chat Dereck Rojas</h1>
        <SignOut usersRef={usersRef} />
      </header>

      <section>
        {user ? (
          <>
           <UserList users={users} onSelectUser={handleSelectUser} />
           <ChatRoom chatType={chatType} selectedUser={selectedUser} />
          </>
        ) : (
          <SignIn usersRef={usersRef} />
        )}
      </section>
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
      <button className="sign-in" onClick={signInWithGoogle}>Iniciar Sesion con Google</button>
    </>
  )

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
    <button className="sign-out" onClick={handleSignOut}>Cerrar Sesion</button>
  );
}

function ChatRoom({ chatType, selectedUser }) {
  const dummy = useRef();
  const messagesRef = firestore.collection('messages');
  const query = messagesRef.orderBy('createdAt').limit(25);

  const privateMessagesRef = firestore.collection('privateMessages');
  const privateQuery = useMemo(() => {
    if (!selectedUser || !auth.currentUser || !auth.currentUser.uid) {
      return null;
    }
    const chatId = auth.currentUser.uid < selectedUser ? auth.currentUser.uid + '_' + selectedUser : selectedUser + '_' + auth.currentUser.uid;
    return privateMessagesRef
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt')
      .limit(25);
  }, [selectedUser, privateMessagesRef]);

  const [publicMessages] = useCollectionData(query, { idField: 'id' });
  const [privateMessagesData] = useCollectionData(privateQuery, { idField: 'id' });

  const messages = chatType === 'private' ? privateMessagesData : publicMessages;

  const [formValue, setFormValue] = useState('');

  const sendMessage = async (e) => {
    e.preventDefault();
  
    const { uid, photoURL } = auth.currentUser;
  
    const newMessage = {
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
    };
  
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
    <>
      <main>
        {messages &&
          messages.map((msg, index) => (
            <ChatMessage key={`${msg.uid}-${index}`} message={msg} />
          ))}
  
        <span ref={dummy}></span>
      </main>
  
      <form onSubmit={sendMessage}>
        <input
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
          placeholder="Escribe algo..."
        />
  
        <button type="submit" disabled={!formValue}>
          Enviar
        </button>
      </form>
    </>
  );  
}

function UserList({ users, onSelectUser }) {
  return (
    <div className="user-list">
      <h2>Usuarios en línea</h2>
      <ul>
        {users &&
          users
            .filter((user) => user.online)
            .map((user) => (
              <li key={user.uid} onClick={() => onSelectUser(user.uid)}>
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

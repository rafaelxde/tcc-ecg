import {
  initializeApp
} from 'firebase/app';

import {
  getAuth
} from 'firebase/auth';

import {
  getDatabase
} from 'firebase/database';


const firebaseConfig = {

  apiKey:
    'AIzaSyAPX4sBxYXYenWRpRGqETrjopok8rUHF88',

  authDomain:
    'ecg-watch-tcc.firebaseapp.com',

  databaseURL:
    'https://ecg-watch-tcc-default-rtdb.firebaseio.com',

  projectId:
    'ecg-watch-tcc',

  storageBucket:
    'ecg-watch-tcc.firebasestorage.app',

  messagingSenderId:
    '547081065322',

  appId:
    '1:547081065322:web:a02f808b907e92abdb0b13'
};


export const firebaseApp =
  initializeApp(
    firebaseConfig
  );


export const auth =
  getAuth(
    firebaseApp
  );


export const database =
  getDatabase(
    firebaseApp
  );

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import './Home.css';
import { useHistory } from 'react-router-dom';


const Home: React.FC = () => {
  const history = useHistory();

  const navigateToBleScan = () => {
    history.push('/ble-scan');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>SIEMENS GG</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonButton expand="block" onClick={navigateToBleScan}>
          Go to BLE Scanner
        </IonButton>

        <ExploreContainer />
      </IonContent>
    </IonPage>
  );
};

export default Home;

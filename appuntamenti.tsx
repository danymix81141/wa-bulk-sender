import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Componenti dell'Interfaccia Spostati Fuori ---

const EntryScreen = ({ onEnter }) => (
    <div className="entry-screen">
        <div className="entry-box">
            <img src="/logo.png" alt="Logo" className="entry-logo" />
            <button onClick={onEnter} className="btn btn-primary btn-enter">Entra</button>
        </div>
    </div>
);

const RenderEventItem = ({ e }) => {
    const startTime = new Date(e.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return (
         <div key={e.id} className="event-item" title={e.message}>
            {startTime} - Occupato
        </div>
    )
};

const RenderHeader = ({ currentDate, view, setView, setCurrentDate, handleNav, getTitle }) => (
    <div className="calendar-header">
        <div className="calendar-header-left">
            <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>Oggi</button>
            <div className="calendar-nav-arrows">
                <button onClick={() => handleNav('prev')} aria-label="Mese precedente"><i className="fa-solid fa-chevron-left"></i></button>
                <button onClick={() => handleNav('next')} aria-label="Mese successivo"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
        <h2>{getTitle()}</h2>
        <div className="calendar-header-right">
            <div className="view-switcher">
                {[
                    { value: 'month', label: 'Mese' },
                    { value: 'week', label: 'Settimana' },
                    { value: 'day', label: 'Giorno' },
                ].map(option => (
                    <button 
                        key={option.value} 
                        className={`btn ${view === option.value ? 'active' : ''}`} 
                        onClick={() => setView(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

const RenderMonthView = ({ currentDate, events }) => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1)); // Start week on Monday
    const endDate = new Date(monthEnd);
     if (endDate.getDay() !== 0) {
         endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
     }

    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const dayHeaders = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return (
        <>
          <div className="calendar-grid">
              {dayHeaders.map(h => <div key={h} className="calendar-day-header">{h}</div>)}
          </div>
          <div className="calendar-grid">
            {days.map((d, i) => {
                const isToday = new Date().toDateString() === d.toDateString();
                const isOtherMonth = d.getMonth() !== currentDate.getMonth();
                const dayEvents = events.filter(e => new Date(e.dateTime).toDateString() === d.toDateString());
                return (
                    <div key={i} className={`calendar-day ${isToday ? 'is-today' : ''} ${isOtherMonth ? 'other-month' : ''}`}>
                        <span className={`day-number ${isToday ? 'is-today-num' : ''}`}>{d.getDate()}</span>
                        <div className="events-container">
                            {dayEvents.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(e => <RenderEventItem e={e} key={e.id} />)}
                        </div>
                    </div>
                );
            })}
          </div>
        </>
    );
};

const RenderDayView = ({ currentDate, events }) => {
    const DAY_START_HOUR = 7;
    const DAY_END_HOUR = 22;
    const SLOT_HEIGHT_PX = 60; // Represents 1 hour

    const timeSlots = [];
    for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour++) {
        const dateWithTime = new Date(currentDate);
        dateWithTime.setHours(hour, 0, 0, 0);
        timeSlots.push(dateWithTime);
    }
    
    const dayEvents = events.filter(e => new Date(e.dateTime).toDateString() === currentDate.toDateString());

    return (
        <div className="day-view-container">
            {timeSlots.map((slot, i) => (
                <div key={i} className="time-slot">
                    <div className="time-label">{slot.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</div>
                    <div className="time-content"></div>
                </div>
            ))}
            <div className="day-view-events-layer">
                {dayEvents.map(event => {
                    if (!event.endDateTime) return null;
                    const start = new Date(event.dateTime);
                    const end = new Date(event.endDateTime);
                    if(start.getHours() >= DAY_END_HOUR + 1 || end.getHours() < DAY_START_HOUR) return null;
                    const startHours = Math.max(DAY_START_HOUR, start.getHours() + start.getMinutes() / 60);
                    const endHours = Math.min(DAY_END_HOUR + 1, end.getHours() + end.getMinutes() / 60);
                    const top = (startHours - DAY_START_HOUR) * SLOT_HEIGHT_PX;
                    const height = (endHours - startHours) * SLOT_HEIGHT_PX;
                    if (height <= 1) return null;
                    const startTimeStr = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
                    const endTimeStr = end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
                    return (
                        <div 
                            key={event.id} 
                            className="day-view-event" 
                            style={{ top: `${top}px`, height: `${height - 2}px`, background: 'var(--accent-color-secondary)', borderLeft: '3px solid var(--accent-color)' }}
                            title={`${startTimeStr} - ${endTimeStr}: Occupato`}
                        >
                            <span className="event-time">Occupato</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RenderBookingInterface = (props) => {
    const { 
        servicesData, selectedServices, handleServiceChange, totalDuration, 
        bookingDate, setBookingDate, bookingTime, setBookingTime, setAvailabilityResult,
        userName, setUserName, userPhone, setUserPhone, handleAvailabilityCheck, isBooking,
        availabilityResult, handleConfirmBooking, isServicesLoading
    } = props;

    if (isServicesLoading) {
        return (
            <div className="booking-container">
                <h3>Caricamento Servizi...</h3>
                <div className="spinner-container"><span className="spinner dark"></span></div>
            </div>
        );
    }

    return (
        <div className="booking-container">
            <h3>Prenota un Appuntamento</h3>
            
            <div className="service-selection">
                <h4>1. Seleziona i servizi</h4>
                {servicesData.map(service => (
                    <div key={service.id} className="form-check">
                        <input type="checkbox" className="form-check-input" id={service.id} checked={!!selectedServices[service.id]} onChange={() => handleServiceChange(service.id)} />
                        <label htmlFor={service.id} className="form-check-label">{service.name} ({service.duration} min)</label>
                    </div>
                ))}
            </div>

            <div className="duration-display">
                <strong>Durata totale: {totalDuration} minuti</strong>
            </div>

            <div className="time-selection">
                <h4>2. Scegli data e ora</h4>
                <div className="form-group">
                    <label htmlFor="booking-date">Data</label>
                    <input type="date" id="booking-date" className="form-control" value={bookingDate} onChange={e => { setBookingDate(e.target.value); setAvailabilityResult(null); }} />
                </div>
                <div className="form-group">
                    <label htmlFor="booking-time">Ora</label>
                    <input type="time" id="booking-time" className="form-control" value={bookingTime} onChange={e => { setBookingTime(e.target.value); setAvailabilityResult(null); }} />
                </div>
            </div>

            <div className="customer-details">
                 <h4>3. I tuoi dati</h4>
                <div className="form-group">
                    <label htmlFor="user-name">Nome</label>
                    <input type="text" id="user-name" className="form-control" placeholder="Il tuo nome" value={userName} onChange={e => setUserName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="user-phone">Telefono</label>
                    <input type="tel" id="user-phone" className="form-control" placeholder="Il tuo numero di telefono" value={userPhone} onChange={e => setUserPhone(e.target.value)} />
                </div>
            </div>

            <button className="btn btn-primary" onClick={handleAvailabilityCheck} disabled={totalDuration === 0 || isBooking}>
                Verifica Disponibilità
            </button>

            {availabilityResult && (
                <div className="availability-result">
                    <h4>Risultato:</h4>
                    <p className={availabilityResult.isAvailable ? 'text-success' : 'text-danger'}>{availabilityResult.message}</p>
                    {availabilityResult.isAvailable && (
                        <button className="btn btn-success" onClick={handleConfirmBooking} disabled={!userName.trim() || !userPhone.trim() || isBooking}>
                            {isBooking ? 'Prenotazione in corso...' : 'Conferma e Prenota Ora'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Dati dei Servizi (Caricati dal Backend) ---

// --- Componente Principale Logico ---
const PublicCalendarComponent = () => {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month'); // month, week, day

    const [servicesData, setServicesData] = useState([]);
    const [isServicesLoading, setIsServicesLoading] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await fetch('/api/services');
                if (!response.ok) throw new Error('Failed to fetch services');
                const data = await response.json();
                setServicesData(data);
            } catch (error) {
                console.error("Error fetching services:", error);
                alert("Impossibile caricare i servizi.");
            } finally {
                setIsServicesLoading(false);
            }
        };
        fetchServices();
    }, []);

    // Stati per la prenotazione
    const [selectedServices, setSelectedServices] = useState({});
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
    const [bookingTime, setBookingTime] = useState('09:00');
    const [userName, setUserName] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [availabilityResult, setAvailabilityResult] = useState(null);
    const [isBooking, setIsBooking] = useState(false);

    const fetchAppointments = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/public/appointments');
            if (!response.ok) throw new Error('Failed to fetch appointments');
            const data = await response.json();
            const formattedData = data.map(item => ({ ...item, dateTime: item.start, endDateTime: item.end, message: 'Occupato' }));
            setEvents(formattedData);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            alert("Impossibile caricare gli appuntamenti.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const handleServiceChange = (serviceId) => {
        setSelectedServices(prev => ({
            ...prev,
            [serviceId]: !prev[serviceId]
        }));
        setAvailabilityResult(null);
    };

    const handleAvailabilityCheck = () => {
        const selectedIds = Object.keys(selectedServices).filter(k => selectedServices[k]);
        if (selectedIds.length === 0) {
            setAvailabilityResult({ message: "Per favore, seleziona almeno un servizio.", isAvailable: false });
            return;
        }

        const requestedStart = new Date(`${bookingDate}T${bookingTime}`);
        const totalDuration = servicesData
            .filter(s => selectedIds.includes(s.id))
            .reduce((total, s) => total + s.duration, 0);
        const requestedEnd = new Date(requestedStart.getTime() + totalDuration * 60000);

        const isOverlapping = (start1, end1, start2, end2) => start1 < end2 && start2 < end1;

        const hasConflict = (start, end) => events.some(event => {
            const eventStart = new Date(event.dateTime);
            const eventEnd = new Date(event.endDateTime);
            return isOverlapping(start, end, eventStart, eventEnd);
        });

        if (!hasConflict(requestedStart, requestedEnd)) {
            setAvailabilityResult({
                message: `Disponibile! L'appuntamento per ${selectedIds.map(id => servicesData.find(s=>s.id===id).name).join(', ')} può essere prenotato.`,
                isAvailable: true,
                services: selectedIds,
                duration: totalDuration
            });
            return;
        }

        const getSubsets = (arr) => arr.reduce((subsets, value) => subsets.concat(subsets.map(set => [value, ...set])), [[]]).slice(1);
        const serviceSubsets = getSubsets(selectedIds).sort((a, b) => {
            const durationA = a.reduce((acc, id) => acc + servicesData.find(s => s.id === id).duration, 0);
            const durationB = b.reduce((acc, id) => acc + servicesData.find(s => s.id === id).duration, 0);
            return durationB - durationA;
        });

        for (const subset of serviceSubsets) {
            const subsetDuration = subset.reduce((acc, id) => acc + servicesData.find(s => s.id === id).duration, 0);
            const subsetEnd = new Date(requestedStart.getTime() + subsetDuration * 60000);

            if (!hasConflict(requestedStart, subsetEnd)) {
                const serviceNames = subset.map(id => servicesData.find(s => s.id === id).name);
                setAvailabilityResult({
                    message: `Spazio non sufficiente per tutti i servizi. Tuttavia, è possibile prenotare per: ${serviceNames.join(', ')}.`,
                    isAvailable: true,
                    services: subset,
                    duration: subsetDuration
                });
                return;
            }
        }

        setAvailabilityResult({ message: "Nessuna disponibilità trovata per i servizi scelti in questo orario.", isAvailable: false });
    };
    
    const handleConfirmBooking = async () => {
        if (!availabilityResult || !availabilityResult.isAvailable) {
            alert("Nessuna disponibilità da prenotare.");
            return;
        }
        if (!userName.trim() || !userPhone.trim()) {
            alert("Per favore, inserisci nome e numero di telefono.");
            return;
        }
        
        setIsBooking(true);
        const startDateTime = new Date(`${bookingDate}T${bookingTime}`);
        const endDateTime = new Date(startDateTime.getTime() + availabilityResult.duration * 60000);
        const serviceNames = availabilityResult.services.map(id => servicesData.find(s => s.id === id).name);

        const bookingData = {
            contact: { name: userName, number: userPhone },
            dateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString(),
            message: `Appuntamento per ${userName}: ${serviceNames.join(', ')}`,
        };

        try {
            const response = await fetch('/api/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante la prenotazione.');
            }

            alert('Appuntamento prenotato con successo!');
            setUserName('');
            setUserPhone('');
            setSelectedServices({});
            setAvailabilityResult(null);
            fetchAppointments();

        } catch (error) {
            console.error("Booking error:", error);
            alert(`Errore: ${error.message}`);
        } finally {
            setIsBooking(false);
        }
    };

    const totalDuration = servicesData
        .filter(s => selectedServices[s.id])
        .reduce((total, s) => total + s.duration, 0);

    const handleNav = (direction) => {
        setCurrentDate(current => {
            const newDate = new Date(current);
            if (view === 'week') {
                newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
            } else if (view === 'day') {
                newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1));
            } else { // month view
                newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
            }
            return newDate;
        });
    };

    const getTitle = () => {
        const options = { timeZone: 'Europe/Rome' };
        if (view === 'day') {
            return currentDate.toLocaleDateString('it-IT', { ...options, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (view === 'week') {
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            const startStr = startOfWeek.toLocaleDateString('it-IT', { ...options, day: '2-digit', month: '2-digit' });
            const endStr = endOfWeek.toLocaleDateString('it-IT', { ...options, day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${startStr} - ${endStr}`;
        }
        return currentDate.toLocaleString('it-IT', { ...options, month: 'long', year: 'numeric' });
    };

    return (
        <div className="app-container public-view">
             <header className="app-header">
                <h1>Hair-stylist Valeria</h1>
            </header>
            <main className="content">
                <div className="calendar-container">
                    <RenderHeader 
                        currentDate={currentDate} 
                        view={view} 
                        setView={setView} 
                        setCurrentDate={setCurrentDate} 
                        handleNav={handleNav} 
                        getTitle={getTitle} 
                    />
                    {isLoading ? <div className="spinner-container"><span className="spinner dark"></span></div> : 
                        view === 'month' ? <RenderMonthView currentDate={currentDate} events={events} /> : <RenderDayView currentDate={currentDate} events={events} />
                    }
                </div>
                <RenderBookingInterface 
                    servicesData={servicesData}
                    isServicesLoading={isServicesLoading}
                    selectedServices={selectedServices}
                    handleServiceChange={handleServiceChange}
                    totalDuration={totalDuration}
                    bookingDate={bookingDate}
                    setBookingDate={setBookingDate}
                    bookingTime={bookingTime}
                    setBookingTime={setBookingTime}
                    setAvailabilityResult={setAvailabilityResult}
                    userName={userName}
                    setUserName={setUserName}
                    userPhone={userPhone}
                    setUserPhone={setUserPhone}
                    handleAvailabilityCheck={handleAvailabilityCheck}
                    isBooking={isBooking}
                    availabilityResult={availabilityResult}
                    handleConfirmBooking={handleConfirmBooking}
                />
            </main>
            <footer className="app-footer">© 2024 WADesk</footer>
        </div>
    );
};

// --- Componente Radice --- 
const App = () => {
    const [hasEntered, setHasEntered] = useState(false);

    if (!hasEntered) {
        return <EntryScreen onEnter={() => setHasEntered(true)} />;
    }

    return <PublicCalendarComponent />;
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
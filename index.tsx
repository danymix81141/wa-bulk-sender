import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

    // MOCK DATA (for preview mode)
    const MOCK_CONTACTS = [
        { name: 'Mario Rossi', number: '393331112233'},
        { name: 'Laura Bianchi', number: '393478889900'},
        { name: 'Paolo Verdi', number: '393385556677'},
    ];
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const MOCK_APPOINTMENTS = [
        { id: 1, dateTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), endDateTime: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(), contactName: 'Mario Rossi', contactNumber: '393331112233', message: 'Taglio', jobType: 'appointment', serviceIds: ['taglio'] },
        { id: 2, dateTime: new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(), endDateTime: new Date(tomorrow.setHours(10, 30, 0, 0)).toISOString(), contactName: 'Laura Bianchi', contactNumber: '393478889900', message: 'Colore, Piega', jobType: 'appointment', serviceIds: ['colore', 'piega'] },
    ];
    const MOCK_SERVICES = [
        { id: 'taglio', name: 'Taglio', duration: 60, cost: 25 },
        { id: 'colore', name: 'Colore', duration: 90, cost: 50 },
        { id: 'piega', name: 'Piega', duration: 30, cost: 15 },
    ];

    // --- SUB-COMPONENTS ---

    const LoginComponent = ({ status, qrCodeUrl, onEnterPreview }) => {
      return (
        <div className="login-container">
          <div className="login-box">
            <header className="app-header"><h1>Login to WhatsApp</h1></header>
            <div className="login-content">
              <p className="login-instructions">To use the bulk sender, please link your WhatsApp account.</p>
              <div className="qr-code-container">
                {qrCodeUrl ? <img src={qrCodeUrl} alt="WhatsApp Login QR Code" /> : <div className="spinner-container"><span className="spinner dark"></span></div>}
              </div>
              <div className="login-status" aria-live="polite">
                {status !== 'Please scan the QR code to log in.' && <span className="spinner dark small"></span>}
                <span>{status}</span>
              </div>
              <ul className="login-steps">
                <li>Open WhatsApp on your phone.</li>
                <li>Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong>.</li>
                <li>Tap on <strong>Link a Device</strong> and scan the QR code.</li>
              </ul>
              <button className="btn btn-link" onClick={onEnterPreview}>
                <i className="fa-solid fa-eye"></i> Entra in modalità Anteprima
              </button>
            </div>
            <footer className="app-footer">Your chat history is not stored on our servers.</footer>
          </div>
        </div>
      );
    };
    
    // Address Book V2
    const AddressBookV2Component = ({ isPreview }) => {
        const [whatsAppContacts, setWhatsAppContacts] = useState([]);
        const [internalContacts, setInternalContacts] = useState(isPreview ? MOCK_CONTACTS : []);
        const [selectedContactNumbers, setSelectedContactNumbers] = useState(new Set());
        const [isLoading, setIsLoading] = useState(false);

        const fetchInternalContacts = async () => {
            if (isPreview) return;
            try {
                const response = await fetch('/api/address-book');
                const data = await response.json();
                setInternalContacts(data || []);
            } catch (error) {
                console.error("Failed to fetch internal contacts:", error);
                alert("Failed to fetch internal contacts.");
            }
        };

        useEffect(() => {
            fetchInternalContacts();
        }, [isPreview]);

        const handleLoadFromWhatsApp = async () => {
            if (isPreview) {
                setWhatsAppContacts([
                    ...MOCK_CONTACTS, 
                    { name: 'Giulia Neri', number: '393334445566'},
                    { name: 'Marco Gialli', number: '393351231234'}
                ]);
                return;
            }
            setIsLoading(true);
            try {
                const response = await fetch('/api/whatsapp-contacts');
                if (!response.ok) throw new Error('Failed to fetch from WhatsApp');
                const data = await response.json();
                setWhatsAppContacts(data.contacts || []);
            } catch (error) {
                alert(`Error loading contacts: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        const handleSelectionChange = (number) => {
            setSelectedContactNumbers(prev => {
                const newSet = new Set(prev);
                if (newSet.has(number)) {
                    newSet.delete(number);
                } else {
                    newSet.add(number);
                }
                return newSet;
            });
        };
        
        const handleSelectAll = () => {
            const allNumbers = whatsAppContacts.map(c => c.number);
            if (selectedContactNumbers.size === allNumbers.length) {
                setSelectedContactNumbers(new Set());
            } else {
                setSelectedContactNumbers(new Set(allNumbers));
            }
        };
        
        const areAllSelected = whatsAppContacts.length > 0 && selectedContactNumbers.size === whatsAppContacts.length;
        const areSomeSelected = whatsAppContacts.length > 0 && selectedContactNumbers.size > 0 && !areAllSelected;


        const handleAddToInternal = async () => {
            const contactsToAdd = whatsAppContacts.filter(c => selectedContactNumbers.has(c.number));
            if (contactsToAdd.length === 0) return alert('No contacts selected.');

            if (isPreview) {
                const newContacts = [...internalContacts];
                contactsToAdd.forEach(c => {
                    if (!newContacts.some(ic => ic.number === c.number)) {
                        newContacts.push(c);
                    }
                });
                setInternalContacts(newContacts);
                setSelectedContactNumbers(new Set());
                alert(`${contactsToAdd.length} contacts added to preview address book.`);
                return;
            }

            try {
                const response = await fetch('/api/address-book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contacts: contactsToAdd })
                });
                if (!response.ok) throw new Error('Failed to save contacts');
                const updatedContacts = await response.json();
                setInternalContacts(updatedContacts.contacts);
                setSelectedContactNumbers(new Set());
                alert('Contacts added successfully!');
            } catch (error) {
                alert(`Error saving contacts: ${error.message}`);
            }
        };

        return (
            <div className="address-book-v2-container">
                <div className="address-book-panel">
                    <div className="address-book-panel-header">
                        <h3><i className="fa-brands fa-whatsapp"></i> Contatti WhatsApp</h3>
                        {whatsAppContacts.length > 0 && (
                            <label className="select-all-label">
                                <input
                                    type="checkbox"
                                    ref={el => { if(el) el.indeterminate = areSomeSelected; }}
                                    checked={areAllSelected}
                                    onChange={handleSelectAll}
                                />
                                Seleziona tutti
                            </label>
                        )}
                    </div>
                    <div className="address-book-actions">
                        <button className="btn btn-primary" onClick={handleLoadFromWhatsApp} disabled={isLoading || isPreview}>
                            {isLoading ? <span className="spinner"></span> : <i className="fa-solid fa-sync"></i>}
                            Carica da WhatsApp
                        </button>
                        {isPreview && <button className="btn btn-secondary" onClick={handleLoadFromWhatsApp}>Carica Dati Demo</button>}
                    </div>
                    {isLoading ? <div className="spinner-container"><span className="spinner dark"></span></div> :
                        <ul className="contact-list-v2">
                            {whatsAppContacts.length > 0 ? whatsAppContacts.map(c => (
                                <li key={c.number} className="contact-item-v2">
                                    <label>
                                        <input type="checkbox" checked={selectedContactNumbers.has(c.number)} onChange={() => handleSelectionChange(c.number)} />
                                        <div className="contact-details">
                                            <span className="contact-name">{c.name}</span>
                                            <span className="contact-number">{c.number}</span>
                                        </div>
                                    </label>
                                </li>
                            )) : <p className="no-items-message">Carica i contatti da WhatsApp per iniziare.</p>}
                        </ul>
                    }
                </div>
                <div className="address-book-panel">
                    <div className="address-book-panel-header">
                        <h3><i className="fa-solid fa-address-book"></i> Rubrica Interna</h3>
                    </div>
                    <div className="address-book-actions">
                        <button className="btn btn-secondary" onClick={handleAddToInternal} disabled={selectedContactNumbers.size === 0}>
                            <i className="fa-solid fa-arrow-right"></i> Aggiungi Selezionati
                        </button>
                    </div>
                    <ul className="contact-list-v2">
                        {internalContacts.length > 0 ? internalContacts.map(c => (
                            <li key={c.number} className="contact-item-v2">
                                <i className="fa-solid fa-user" style={{color: 'var(--text-secondary)'}}></i>
                                <div className="contact-details">
                                    <span className="contact-name">{c.name}</span>
                                    <span className="contact-number">{c.number}</span>
                                </div>
                            </li>
                        )) : <p className="no-items-message">La tua rubrica interna è vuota.</p>}
                    </ul>
                </div>
            </div>
        );
    };

    // Calendar Component
    const viewOptions = [
        { value: 'month', label: 'Mese' },
        { value: 'week', label: 'Settimana' },
        { value: 'day', label: 'Giorno' },
    ];

    const CalendarComponent = ({ events, onOpenModal, isPreview }) => {
        const [currentDate, setCurrentDate] = useState(new Date());
        const [view, setView] = useState('month'); // month, week, day

        const handleDayClick = (date) => {
            onOpenModal({ dateTime: date });
        };
        
        const handleTimeSlotClick = (dateWithTime) => {
            onOpenModal({ dateTime: dateWithTime });
        };

        const handleEventClick = (event) => {
            onOpenModal({ appointment: event });
        }
        
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
        
        const renderEventItem = (e) => {
            const startTime = new Date(e.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
            const endTime = e.endDateTime ? new Date(e.endDateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
            const timeString = endTime ? `${startTime} - ${endTime}` : startTime;
            
            return (
                 <div key={e.id} className="event-item" title={e.message} onClick={(ev) => {ev.stopPropagation(); handleEventClick(e)}}> 
                    {timeString} {e.contactName?.split(' ').pop()}
                </div>
            )
        }

        const renderHeader = () => (
            <div className="calendar-header">
                <div className="calendar-header-left">
                    <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>Oggi</button>
                    <div className="calendar-nav-arrows">
                        <button onClick={() => handleNav('prev')} aria-label="Mese precedente">
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        <button onClick={() => handleNav('next')} aria-label="Mese successivo">
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <h2>{getTitle()}</h2>
                <div className="calendar-header-right">
                    <button className="btn btn-add-appointment" onClick={() => onOpenModal({ dateTime: new Date() }) }>
                        <i className="fa-solid fa-plus"></i> Aggiungi Appuntamento
                    </button>
                    <div className="view-switcher">
                        {viewOptions.map(option => (
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

        const renderMonthView = () => {
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            const startDate = new Date(monthStart);
            const startDay = startDate.getDay();
            startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay -1)); // Start week on Monday
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
                            <div key={i} className={`calendar-day ${isToday ? 'is-today' : ''} ${isOtherMonth ? 'other-month' : ''}`} onClick={() => handleDayClick(d)}>
                                <span className={`day-number ${isToday ? 'is-today-num' : ''}`}>{d.getDate()}</span>
                                <div className="events-container">
                                    {dayEvents.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(e => renderEventItem(e))}
                                </div>
                            </div>
                        );
                    })}
                  </div>
                </>
            );
        };
        
        const renderWeekView = () => {
            const dayHeaders = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
            const startOfWeek = new Date(currentDate);
            const dayOfWeek = startOfWeek.getDay();
            startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Start on Monday

            const days = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(day.getDate() + i);
                days.push(day);
            }
            
            return (
                <>
                    <div className="week-grid">
                        {dayHeaders.map(h => <div key={h} className="calendar-day-header">{h}</div>)}
                    </div>
                    <div className="week-grid">
                        {days.map((d, i) => {
                            const isToday = new Date().toDateString() === d.toDateString();
                            const dayEvents = events.filter(e => new Date(e.dateTime).toDateString() === d.toDateString());
                            return (
                                <div key={i} className={`calendar-day week-view-day ${isToday ? 'is-today' : ''}`} onClick={() => handleDayClick(d)}>
                                    <span className={`day-number ${isToday ? 'is-today-num' : ''}`}>{d.getDate()}</span>
                                    <div className="events-container">
                                        {dayEvents.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(e => renderEventItem(e))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            );
        };

        const renderDayView = () => {
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
                    {/* Background grid of time slots */}
                    {timeSlots.map((slot, i) => (
                        <div key={i} className="time-slot" onClick={() => handleTimeSlotClick(slot)}>
                            <div className="time-label">{slot.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</div>
                            <div className="time-content"></div>
                        </div>
                    ))}
                    
                    {/* Foreground layer for events */}
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
                                    style={{ top: `${top}px`, height: `${height - 2}px` }}
                                    title={`${startTimeStr} - ${endTimeStr}: ${event.message}`}
                                    onClick={(ev) => {ev.stopPropagation(); handleEventClick(event)}}
                                >
                                    <span className="event-time">{startTimeStr} - {endTimeStr}</span>
                                    <span className="event-details">{event.contactName}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return (
            <div className="calendar-container">
                {renderHeader()}
                {view === 'month' && renderMonthView()}
                {view === 'week' && renderWeekView()}
                {view === 'day' && renderDayView()}
            </div>
        );
    };

    const RemindersListComponent = ({ jobs, onOpenModal, isPreview }) => {
        const handleDoubleClick = (reminderJob) => {
            const parentAppointment = jobs.find(job => job.id === reminderJob.parentJobId && job.jobType === 'appointment');
            if (parentAppointment) {
                onOpenModal({ appointment: parentAppointment });
            } else {
                alert('Impossibile trovare l\appuntamento principale per questo promemoria. Potrebbe essere stato eliminato.');
            }
        };

        const upcomingReminders = jobs
            .filter(j => j.jobType === 'reminder' && new Date(j.dateTime) > new Date())
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

        return (
            <div className="reminders-list-container">
                <div className="reminders-list-header">
                    <h3><i className="fa-solid fa-bell"></i> Prossimi Promemoria in Uscita</h3>
                </div>
                {upcomingReminders.length > 0 ? (
                    <ul className="reminders-list">
                        {upcomingReminders.map(reminder => {
                             const reminderDate = new Date(reminder.dateTime);
                             const dateString = reminderDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                             const timeString = reminderDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                            return (
                                <li key={reminder.id} className="reminder-list-item" onDoubleClick={() => handleDoubleClick(reminder)}>
                                    <div className="reminder-info">
                                        <span className="reminder-contact">A: {reminder.contactName}</span>
                                        <span className="reminder-message">"{reminder.message}"</span>
                                    </div>
                                    <div className="reminder-time">
                                        <span className="date">{dateString}</span>
                                        <span className="time">alle {timeString}</span>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="no-items-message">Nessun promemoria in programma.</p>
                )}
            </div>
        );
    };

    

    const ServicesComponent = ({ isPreview }) => {
        const [services, setServices] = useState([]);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            if (isPreview) {
                setServices(MOCK_SERVICES);
                setIsLoading(false);
                return;
            }
            const fetchServices = async () => {
                try {
                    const response = await fetch('/api/services');
                    if (!response.ok) throw new Error('Failed to fetch services');
                    const data = await response.json();
                    setServices(data);
                } catch (error) {
                    console.error("Error fetching services:", error);
                    alert("Impossibile caricare i servizi.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchServices();
        }, [isPreview]);

        return (
            <div className="services-management-container">
                <h3><i className="fa-solid fa-scissors"></i> Gestione Servizi</h3>
                {isLoading ? (
                    <div className="spinner-container"><span className="spinner dark"></span></div>
                ) : services.length > 0 ? (
                    <ul className="services-list">
                        {services.map(service => (
                            <li key={service.id} className="service-item">
                                <span className="service-name">{service.name}</span>
                                <span className="service-details">{service.duration} min, €{service.cost.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="no-items-message">Nessun servizio configurato.</p>
                )}
            </div>
        );
    };

    const AppointmentModal = ({ isOpen, onClose, appointmentData, onSave, onDelete, isPreview }) => {
        const [id, setId] = useState(null);
        const [contact, setContact] = useState('');
        const [internalContacts, setInternalContacts] = useState(isPreview ? MOCK_CONTACTS : []);
        const [date, setDate] = useState('');
        const [startTime, setStartTime] = useState('');
        
        // Service-related state
        const [availableServices, setAvailableServices] = useState(isPreview ? MOCK_SERVICES : []);
        const [selectedServices, setSelectedServices] = useState(new Set());
        const [totalDuration, setTotalDuration] = useState(0);
        const [totalCost, setTotalCost] = useState(0);

        const [reminders, setReminders] = useState([]);
        const [isSaving, setIsSaving] = useState(false);
        const [isDeleting, setIsDeleting] = useState(false);
        const isEditMode = appointmentData?.appointment != null;

        // Fetch contacts and services
        useEffect(() => {
            if (isOpen && !isPreview) {
                fetch('/api/address-book').then(res => res.json()).then(data => setInternalContacts(data || []));
                fetch('/api/services').then(res => res.json()).then(data => setAvailableServices(data || []));
            }
        }, [isOpen, isPreview]);

        // Populate form on open
        useEffect(() => {
            if (isEditMode) {
                const { appointment } = appointmentData;
                const startDate = new Date(appointment.dateTime);
                setId(appointment.id);
                setContact(appointment.contactNumber || '');
                setDate(startDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
                setStartTime(startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
                
                // Pre-select services if they exist on the appointment
                if (appointment.serviceIds) {
                    setSelectedServices(new Set(appointment.serviceIds));
                } else {
                    setSelectedServices(new Set());
                }
            } else if (appointmentData?.dateTime) {
                // New appointment defaults
                const d = new Date(appointmentData.dateTime);
                setDate(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
                setStartTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
                setSelectedServices(new Set());
            }
        }, [appointmentData, isEditMode]);

        // Recalculate totals when selected services change
        useEffect(() => {
            let duration = 0;
            let cost = 0;
            selectedServices.forEach(serviceId => {
                const service = availableServices.find(s => s.id === serviceId);
                if (service) {
                    duration += service.duration;
                    cost += service.cost;
                }
            });
            setTotalDuration(duration);
            setTotalCost(cost);
        }, [selectedServices, availableServices]);

        const handleServiceToggle = (serviceId) => {
            setSelectedServices(prev => {
                const newSet = new Set(prev);
                if (newSet.has(serviceId)) {
                    newSet.delete(serviceId);
                } else {
                    newSet.add(serviceId);
                }
                return newSet;
            });
        };

        const handleSave = async () => {
            if (!contact || !date || !startTime || selectedServices.size === 0) {
                return alert('Contatto, data, ora e almeno un servizio sono obbligatori.');
            }
            
            const selectedContact = internalContacts.find(c => c.number === contact);
            if (!selectedContact) return alert('Contatto non valido.');

            const [day, month, year] = date.split('/');
            const startDateTime = new Date(`${year}-${month}-${day}T${startTime}`);
            const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000);

            const serviceNames = Array.from(selectedServices).map(id => availableServices.find(s => s.id === id)?.name || '');
            const message = `Appuntamento per: ${serviceNames.join(', ')}`;

            const payload = {
                appointment: {
                    id: isEditMode ? id : undefined,
                    contact: selectedContact,
                    contactNumber: selectedContact.number,
                    dateTime: startDateTime.toISOString(),
                    endDateTime: endDateTime.toISOString(),
                    message,
                    serviceIds: Array.from(selectedServices), // Send service IDs
                    totalCost, // Send total cost
                },
                reminders: [], // Reminder logic can be added back here if needed
            };

            setIsSaving(true);
            try {
                const response = await fetch('/api/schedule-appointment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) throw new Error(`Impossibile ${isEditMode ? 'modificare' : 'salvare'} l'appuntamento`);
                alert(` Appuntamento ${isEditMode ? 'modificato' : 'salvato'} con successo!`);
                onSave();
            } catch (error) {
                alert(`Errore: ${error.message}`);
            } finally {
                setIsSaving(false);
            }
        };

        const handleDelete = async () => {
            if (!isEditMode || !id) return;

            if (window.confirm("Sei sicuro di voler eliminare questo appuntamento? L'azione è irreversibile.")) {
                setIsDeleting(true);
                try {
                    if (isPreview) {
                        await new Promise(res => setTimeout(res, 1000));
                        alert('(Anteprima) Appuntamento eliminato!');
                    } else {
                        const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Impossibile eliminare l\appuntamento');
                        alert(' Appuntamento eliminato con successo.');
                    }
                    onSave();
                } catch (error) {
                    alert(`Errore: ${error.message}`);
                } finally {
                    setIsDeleting(false);
                }
            }
        };

        if (!isOpen) return null;

        return (
            <div className="modal-backdrop" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{isEditMode ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}</h3>
                        <button onClick={onClose} className="close-button">&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="contact-select">Contatto</label>
                            <select id="contact-select" value={contact} onChange={e => setContact(e.target.value)}>
                                <option value="">Seleziona un contatto</option>
                                {internalContacts.map(c => <option key={c.number} value={c.number}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Data e Ora</label>
                            <div className="button-group">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Data appuntamento" />
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} aria-label="Ora di inizio" />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label>Servizi</label>
                            <div className="services-checklist">
                                {availableServices.map(service => (
                                    <div key={service.id} className="form-check">
                                        <input 
                                            type="checkbox" 
                                            id={`service-${service.id}`}
                                            checked={selectedServices.has(service.id)}
                                            onChange={() => handleServiceToggle(service.id)}
                                        />
                                        <label htmlFor={`service-${service.id}`}>{service.name} ({service.duration}min, €{service.cost.toFixed(2)})</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="appointment-totals">
                            <div>Durata Totale: <strong>{totalDuration} minuti</strong></div>
                            <div>Costo Totale: <strong>€ {totalCost.toFixed(2)}</strong></div>
                        </div>

                        {/* Reminders section - can be re-added later if needed */}
                        {/* 
                        <div className="reminders-section">
                            <fieldset>
                                <legend>Promemoria Automatici</legend>
                                {reminders.map((r) => (
                                    <div key={r.id} className="reminder-item">
                                        <span>Invia</span>
                                        <input type="number" min={1} value={r.value} onChange={e => handleReminderChange(r.id, 'value', parseInt(e.target.value, 10) || 1)} aria-label="Valore promemoria"/>
                                        <select value={r.unit} onChange={e => handleReminderChange(r.id, 'unit', e.target.value)} aria-label="Unità promemoria">
                                            <option value="days">giorni</option>
                                            <option value="hours">ore</option>
                                        </select>
                                        <span>prima, alle</span>
                                        <input type="text" pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$" maxLength={5} placeholder="HH:MM" value={r.at} onChange={e => handleReminderChange(r.id, 'at', e.target.value)} aria-label="Ora promemoria" />
                                        <button onClick={() => deleteReminder(r.id)} className="delete-reminder-btn" aria-label="Elimina promemoria">&times;</button>
                                    </div>
                                ))}
                               <button className="btn btn-secondary" onClick={addReminder}><i className="fa-solid fa-plus"></i> Aggiungi promemoria</button>
                            </fieldset>
                        </div>
                        */}
                    </div>
                    <div className="modal-footer">
                        {isEditMode && (
                            <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting || isPreview} style={{ marginRight: 'auto' }}>
                                {isDeleting ? <span className="spinner"></span> : <i className="fa-solid fa-trash"></i>}
                                Elimina
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || isPreview}>
                            {isSaving ? <span className="spinner"></span> : <i className="fa-solid fa-save"></i>}
                            {isSaving ? 'Salvataggio...' : (isEditMode ? 'Salva Modifiche' : 'Salva Appuntamento')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const DashboardComponent = ({ jobs, onOpenModal }) => {
        const [availableServices, setAvailableServices] = useState(MOCK_SERVICES); // For dashboard to display service names

        useEffect(() => {
            // Fetch services for dashboard display
            fetch('/api/services').then(res => res.json()).then(data => setAvailableServices(data || []));
        }, []);

        const getServiceNames = (serviceIds) => {
            if (!serviceIds || serviceIds.length === 0) return 'Nessun servizio';
            return serviceIds.map(id => availableServices.find(s => s.id === id)?.name || id).join(', ');
        };

        const isSameDay = (date1, date2) => {
            return date1.getFullYear() === date2.getFullYear() &&
                   date1.getMonth() === date2.getMonth() &&
                   date1.getDate() === date2.getDate();
        };

        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const todaysAppointments = jobs
            .filter(job => job.jobType === 'appointment' && isSameDay(new Date(job.dateTime), today))
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        const tomorrowsAppointments = jobs
            .filter(job => job.jobType === 'appointment' && isSameDay(new Date(job.dateTime), tomorrow))
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        const AppointmentCard = ({ job }) => (
            <li className="appointment-card" onClick={() => onOpenModal({ appointment: job }) }>
                <div className="appointment-card-time">
                    {new Date(job.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                </div>
                <div className="appointment-card-details">
                    <span className="appointment-card-name">{job.contactName}</span>
                    <span className="appointment-card-message">{getServiceNames(job.serviceIds)}</span>
                </div>
            </li>
        );

        return (
            <div className="dashboard-container">
                <div className="dashboard-section">
                    <h3><i className="fa-solid fa-calendar-day"></i> Appuntamenti di Oggi</h3>
                    {todaysAppointments.length > 0 ? (
                        <ul className="appointment-list">{todaysAppointments.map(job => <AppointmentCard key={job.id} job={job} />)}
                        </ul>
                    ) : (
                        <p className="no-items-message">Nessun appuntamento per oggi.</p>
                    )}
                </div>
                <div className="dashboard-section">
                    <h3><i className="fa-solid fa-calendar-check"></i> Appuntamenti di Domani</h3>
                    {tomorrowsAppointments.length > 0 ? (
                        <ul className="appointment-list">{tomorrowsAppointments.map(job => <AppointmentCard key={job.id} job={job} />)}
                        </ul>
                    ) : (
                        <p className="no-items-message">Nessun appuntamento per domani.</p>
                    )}
                </div>
            </div>
        );
    };

    // The main application UI after being logged in.
    const MainAppComponent = ({ onSend, onLogout, lastStatus, isPreview }) => {
      const [activeTab, setActiveTab] = useState('dashboard');
      
      // State for the 'send' tab
      const [numbers, setNumbers] = useState('');
      const [message, setMessage] = useState('Ciao! Ecco uno strumento per l\invio di messaggi massivi che vorrei consigliarti. 🚀');
      const [isSending, setIsSending] = useState(false);
      const [isFileUploading, setIsFileUploading] = useState(false);
      const fileInputRef = useRef(null);

      // Centralized state for appointments & reminders
      const [allJobs, setAllJobs] = useState(isPreview ? MOCK_APPOINTMENTS : []);
      const [isLoadingJobs, setIsLoadingJobs] = useState(!isPreview);
      const [modalState, setModalState] = useState({ isOpen: false, data: null });

      const fetchAllJobs = useCallback(async () => {
        if (isPreview) return;
        setIsLoadingJobs(true);
        try {
            const response = await fetch('/api/scheduled-messages');
            if(!response.ok) throw new Error("Failed to fetch jobs");
            const data = await response.json();
            setAllJobs(data);
        } catch (error) {
            console.error("Error fetching jobs:", error);
            setAllJobs([]);
        } finally {
            setIsLoadingJobs(false);
        }
      }, [isPreview]);

      useEffect(() => {
        fetchAllJobs();
      }, [fetchAllJobs]);

      const handleOpenModal = (data) => {
          if (data.appointment) {
              const remindersForAppointment = allJobs.filter(
                  job => job.jobType === 'reminder' && job.parentJobId === data.appointment.id
              );
              setModalState({ isOpen: true, data: { ...data, reminders: remindersForAppointment } });
          } else {
              setModalState({ isOpen: true, data });
          }
      };
      
      const handleCloseModal = () => setModalState({ isOpen: false, data: null });
      
      const handleSaveAndRefetch = () => {
          handleCloseModal();
          setTimeout(() => fetchAllJobs(), 500);
      };

      const handleFileChange = async (event) => {
        if (!event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const formData = new FormData();
        formData.append('phoneNumbersFile', file);
        setIsFileUploading(true);
        try {
          const response = await fetch('/upload', { method: 'POST', body: formData });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'File upload failed');
          const newNumbers = result.numbers.join(',');
          setNumbers(prev => prev ? `${prev},${newNumbers}` : newNumbers);
          alert(`${result.numbers.length} numeri importati da ${file.name}`);
        } catch (error) {
          alert(`Errore: ${error.message}`);
        } finally {
          setIsFileUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      const handleSend = () => {
        if (!message || !numbers.trim()) return alert("Per favore, inserisci i numeri e un messaggio.");
        setIsSending(true);
        onSend({ numbers, message });
        setTimeout(() => setIsSending(false), 3000);
      };

      const renderTabContent = () => {
        switch(activeTab) {
            case 'dashboard':
                return <DashboardComponent jobs={allJobs} onOpenModal={handleOpenModal} />;
            case 'send':
                return (
                    <>
                        <div className="form-section">
                          <label htmlFor="numbers-input">Numeri di WhatsApp</label>
                          <span className="description">Aggiungi il prefisso internazionale, separa i numeri con una virgola.</span>
                          <textarea id="numbers-input" rows={6} value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="+393331234567,+447700900123"/>
                        </div>
                        <div className="form-section">
                          <label>Importa numeri da File CSV</label>
                          <div className="button-group">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" style={{ display: 'none' }} disabled={isFileUploading || isPreview}/>
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isFileUploading || isPreview}>
                              {isFileUploading ? <span className="spinner dark small"></span> : <i className="fa-solid fa-upload"></i>}
                              {isFileUploading ? 'Caricamento...' : 'Carica CSV'}
                            </button>
                          </div>
                        </div>
                        <div className="form-section message-composer">
                            <label htmlFor="message-input">Testo del Messaggio</label>
                            <textarea id="message-input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" onClick={handleSend} disabled={isSending || isPreview}>
                          {isSending ? <span className="spinner"></span> : 'Invia Messaggio'}
                        </button>
                        <div className="status-bar" aria-live="polite">{isPreview ? 'Modalità anteprima' : lastStatus}</div>
                    </>
                );
            case 'schedule':
                const appointments = allJobs.filter(j => j.jobType === 'appointment');
                return <CalendarComponent events={appointments} onOpenModal={handleOpenModal} isPreview={isPreview} />;
            case 'services':
                return <ServicesComponent isPreview={isPreview} />;
            case 'reminders':
                return <RemindersListComponent jobs={allJobs} onOpenModal={handleOpenModal} isPreview={isPreview} />;
            case 'addressBook':
                return <AddressBookV2Component isPreview={isPreview} />;
            default:
                return null;
        }
      }
      
      return (
        <div className="app-container">
          <header className="app-header">
            <h1>Hair-stylist Valeria</h1>
            <button onClick={onLogout} className="btn btn-logout"><i className="fa-solid fa-right-from-bracket"></i> Logout</button>
          </header>
          <nav className="tabs" aria-label="Navigazione principale">
            <div role="tab" aria-selected={activeTab === 'dashboard'} className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</div>
            <div role="tab" aria-selected={activeTab === 'send'} className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>Invia Messaggi</div>
            <div role="tab" aria-selected={activeTab === 'schedule'} className={`tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>Calendario</div>
            <div role="tab" aria-selected={activeTab === 'services'} className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>Servizi</div>
            <div role="tab" aria-selected={activeTab === 'reminders'} className={`tab ${activeTab === 'reminders' ? 'active' : ''}`} onClick={() => setActiveTab('reminders')}>Promemoria</div>
            <div role="tab" aria-selected={activeTab === 'addressBook'} className={`tab ${activeTab === 'addressBook' ? 'active' : ''}`} onClick={() => setActiveTab('addressBook')}>Rubrica</div>
          </nav>
          <main className="content">
            {isLoadingJobs ? <div className="spinner-container"><span className="spinner dark"></span></div> : renderTabContent()}
          </main>
           {modalState.isOpen && (
              <AppointmentModal 
                  isOpen={modalState.isOpen} 
                  onClose={handleCloseModal}
                  appointmentData={modalState.data}
                  onSave={handleSaveAndRefetch}
                  isPreview={isPreview}
              />
          )}
          <footer className="app-footer">© 2024 WADesk</footer>
        </div>
      );
    };

    // New Entry Screen Component
    const EntryScreen = ({ onEnter }) => {
        return (
            <div className="entry-screen">
                <div className="entry-box">
                    <img src="/logo.png" alt="Logo" className="entry-logo" />
                    <button onClick={onEnter} className="btn btn-primary btn-enter">Entra</button>
                </div>
            </div>
        );
    };

    // Root component to manage state
    const App = () => {
        const [hasEntered, setHasEntered] = useState(false); // New state for the entry screen
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const [status, setStatus] = useState('Connecting to service...');
        const [qrCodeUrl, setQrCodeUrl] = useState('');
        const [isPreview, setIsPreview] = useState(false);
        const ws = useRef(null);

        useEffect(() => {
            if (isPreview || !hasEntered) return; // Don't connect in preview mode or before entering

            const connect = () => {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host ? window.location.host : 'localhost:3000';
                const socket = new WebSocket(`${protocol}//${host}/ws`);
                
                socket.onopen = () => setStatus('Waiting for QR code...');
                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if(data.type === 'qr_code') { setIsAuthenticated(false); setQrCodeUrl(data.url); setStatus('Please scan the QR code to log in.'); }
                        else if(data.type === 'authenticated') { setIsAuthenticated(true); setQrCodeUrl(''); setStatus('User authenticated successfully!'); }
                        else if(data.type === 'status_update') { setStatus(data.message); }
                        else if(data.type === 'logged_out') { setIsAuthenticated(false); setQrCodeUrl(''); setStatus('You have been logged out. Reconnecting...'); }
                    } catch (error) { console.error('Error parsing WebSocket message:', error); }
                };
                socket.onclose = () => { setStatus('Connection lost. Reconnecting...'); setTimeout(connect, 3000); };
                socket.onerror = (error) => { console.error('WebSocket error:', error); socket.close(); };
                ws.current = socket;
            };
            connect();
            return () => {
                if (ws.current) {
                    ws.current.close();
                }
            };
        }, [isPreview, hasEntered]); // Effect depends on hasEntered now

        const handleEnterPreview = () => {
            setIsPreview(true);
            setIsAuthenticated(true);
            setStatus('Modalità Anteprima');
        };
        
        const handleLogout = () => {
            if (isPreview) {
                setIsPreview(false);
                setIsAuthenticated(false);
                setHasEntered(false); // Go back to entry screen
                setStatus('Connecting to service...');
            } else if (ws.current) {
                ws.current.send(JSON.stringify({ type: 'logout' }));
                setHasEntered(false); // Go back to entry screen
            }
        };

        const handleSendMessage = (data) => {
            if (ws.current) {
                ws.current.send(JSON.stringify({ type: 'send_message', payload: data }));
            }
        };
        
        // Render logic based on the new hasEntered state
        if (!hasEntered) {
            return <EntryScreen onEnter={() => setHasEntered(true)} />;
        }

        if (!isAuthenticated) {
            return <LoginComponent status={status} qrCodeUrl={qrCodeUrl} onEnterPreview={handleEnterPreview} />;
        }
        return <MainAppComponent onSend={handleSendMessage} onLogout={handleLogout} lastStatus={status} isPreview={isPreview} />;
    };

    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(<App />);
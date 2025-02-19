$(document).ready(function() {  // Using jQuery for convenience

    let userToken = localStorage.getItem('userToken');
    let userId = localStorage.getItem('userId');
    let currentSkillId = null;
    let testStartTime = null;
    let cheatingDetected = false;

    // UI Elements (Cached for performance)
    const signupBtn = $('#signup-btn');
    const loginBtn = $('#login-btn');
    const logoutBtn = $('#logout-btn');
    const signupForm = $('#signup-form');
    const loginForm = $('#login-form');
    const profileForm = $('#profile-form');
    const recommendedProfiles = $('#recommended-profiles');
    const skillTest = $('#skill-test');
    const chatInterface = $('#chat-interface');
    const feedbackForm = $('#feedback-form');
    const chatMessages = $('#chat-messages');
    const messageInput = $('#message-input');
    const chatPartnerSpan = $('#chat-partner');
    const feedbackPartnerSpan = $('#feedback-partner');

    // ---- Helper Functions ----

    function hideAllForms() {
        signupForm.hide();
        loginForm.hide();
        profileForm.hide();
        recommendedProfiles.hide();
        skillTest.hide();
        chatInterface.hide();
        feedbackForm.hide();
    }

    function showMessage(element, message, isError = false) {
        element.text(message).css('color', isError ? 'red' : 'green');
    }

    function isLoggedIn() {
        return userToken !== null && userId !== null;
    }

    function checkProctoring() {
        // VERY BASIC "proctoring" - check for tab switching (blur/focus)
        $(window).on('blur focus', function(e) {
            if (e.type === 'blur') {
                cheatingDetected = true;
                alert("Warning: Switching tabs during the test is not allowed.");
            } else {
                // You might want to add a delay before allowing focus back
                setTimeout(() => { cheatingDetected = false; }, 2000); // 2 second delay
            }
        });
    }

    // ---- Authentication ----

    signupBtn.click(function() {
        hideAllForms();
        signupForm.show();
    });

    loginBtn.click(function() {
        hideAllForms();
        loginForm.show();
    });

    logoutBtn.click(function() {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userId');
        userToken = null;
        userId = null;
        logoutBtn.hide();
        hideAllForms();
        loginForm.show(); // Or signup form, as you prefer
    });

    $('#signup').submit(function(event) {
        event.preventDefault();
        const email = $('#signup-email').val();
        const username = $('#signup-username').val();
        const password = $('#signup-password').val();

        $.ajax({
            url: '/signup',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email, username, password }),
            success: function(data) {
                showMessage($('#signup-msg'), data.message);
                if (data.success) {
                    signupForm.hide();
                    loginForm.show();
                }
            },
            error: function(err) {
                showMessage($('#signup-msg'), 'Signup failed: ' + err.responseJSON.message, true);
            }
        });
    });

    $('#login').submit(function(event) {
        event.preventDefault();
        const email = $('#login-email').val();
        const password = $('#login-password').val();

        $.ajax({
            url: '/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email, password }),
            success: function(data) {
                if (data.success) {
                    userToken = data.token;
                    userId = data.userId;
                    localStorage.setItem('userToken', userToken);
                    localStorage.setItem('userId', userId);
                    logoutBtn.show();
                    hideAllForms();
                    profileForm.show();
                    loadProfileForm();
                } else {
                    showMessage($('#login-msg'), data.message, true);
                }
            },
            error: function(err) {
                showMessage($('#login-msg'), 'Login failed: ' + err.responseJSON.message, true);
            }
        });
    });

    // ---- Profile Management ----

    async function loadProfileForm() {
        const skillsOfferedDiv = $('#skills-offered');
        const skillsWantedDiv = $('#skills-wanted');
        skillsOfferedDiv.empty();
        skillsWantedDiv.empty();

        try {
            const response = await $.ajax({
                url: '/skills',
                method: 'GET',
                contentType: 'application/json'
            });

            response.forEach(skill => {
                const offeredCheckbox = $(`<input type="checkbox" id="skill-offered-${skill.id}" name="skills_offered" value="${skill.id}">`);
                const offeredLabel = $(`<label for="skill-offered-${skill.id}">${skill.name}</label><br>`);
                skillsOfferedDiv.append(offeredCheckbox, offeredLabel);

                const wantedCheckbox = $(`<input type="checkbox" id="skill-wanted-${skill.id}" name="skills_wanted" value="${skill.id}">`);
                const wantedLabel = $(`<label for="skill-wanted-${skill.id}">${skill.name}</label><br>`);
                skillsWantedDiv.append(wantedCheckbox, wantedLabel);
            });
        } catch (error) {
            console.error('Error loading skills:', error);
            alert('Failed to load skills.  Please try again.');
        }

        // Load the user's existing profile data (if any)
        $.ajax({
            url: '/profile',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` },
            success: function(data) {
                $('#profile-name').val(data.name || '');
                $('#profile-bio').val(data.bio || '');

                // Check the appropriate checkboxes based on existing skills
                if (data.skills_offered) {
                    data.skills_offered.forEach(skillId => {
                        $(`#skill-offered-${skillId}`).prop('checked', true);
                    });
                }
                if (data.skills_wanted) {
                    data.skills_wanted.forEach(skillId => {
                        $(`#skill-wanted-${skillId}`).prop('checked', true);
                    });
                }
            },
            error: function(err) {
                console.warn("Could not get profile", err);
            }
        });
    }

    $('#profile').submit(function(event) {
        event.preventDefault();
        const name = $('#profile-name').val();
        const bio = $('#profile-bio').val();
        const skillsOffered = $('input[name="skills_offered"]:checked').map(function() { return this.value; }).get();
        const skillsWanted = $('input[name="skills_wanted"]:checked').map(function() { return this.value; }).get();

        $.ajax({
            url: '/profile',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: JSON.stringify({ name, bio, skills_offered: skillsOffered, skills_wanted: skillsWanted }),
            success: function(data) {
                alert('Profile updated successfully!');
                loadRecommendedProfiles(); // Load recommendations after profile update
            },
            error: function(err) {
                alert('Failed to update profile: ' + err.responseJSON.message);
            }
        });
    });

    // ---- Skill Tests ----

    function startSkillTest(skillId) {
        currentSkillId = skillId;
        hideAllForms();
        skillTest.show();
        testStartTime = new Date();
        cheatingDetected = false;
        checkProctoring();
        loadTestQuestion();
    }

    function loadTestQuestion() {
        $.ajax({
            url: `/test_question/${currentSkillId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` },
            success: function(data) {
                $('#test-question').text(data.question);
            },
            error: function(err) {
                console.error('Failed to load test question:', err);
                alert('Failed to load test question.  Please try again.');
            }
        });
    }

    $('#submit-answer').click(function() {
        const answer = $('#test-answer').val();
        const timeTaken = (new Date() - testStartTime) / 1000; // in seconds
        const isCheating = cheatingDetected; // Capture the value here

        $.ajax({
            url: `/submit_answer/${currentSkillId}`,
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: JSON.stringify({ answer: answer, time_taken: timeTaken, cheating: isCheating }),
            success: function(data) {
                $('#test-result').text(`Result: ${data.result}, Rating: ${data.rating}`);
                // Give a delay to show the result before going back
                setTimeout(() => {
                    skillTest.hide();
                    loadRecommendedProfiles(); // Refresh recommendations
                    recommendedProfiles.show();
                    $('#test-question').text('');
                    $('#test-answer').val('');
                    $('#test-result').text('');
                }, 2000);
            },
            error: function(err) {
                console.error('Failed to submit answer:', err);
                alert('Failed to submit answer.  Please try again.');
            }
        });
    });

    // ---- Recommendations ----

    async function loadRecommendedProfiles() {
        try {
            const response = await $.ajax({
                url: '/recommendations',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${userToken}` },
                contentType: 'application/json'
            });

            const profileListDiv = $('#profile-list');
            profileListDiv.empty();

            response.forEach(profile => {
                const profileCard = $('<div class="profile-card">');
                profileCard.append(`<h3>${profile.name}</h3>`);
                profileCard.append(`<p>${profile.bio}</p>`);
                profileCard.append(`<p>Skills Offered: ${profile.skills_offered.join(', ')}</p>`);
                profileCard.append(`<p>Skills Wanted: ${profile.skills_wanted.join(', ')}</p>`);
                if (profile.skill_ratings && Object.keys(profile.skill_ratings).length > 0) {
                  profileCard.append("<p>Skill Ratings:</p>");
                  for (const skillName in profile.skill_ratings) {
                    profileCard.append(`<p>${skillName}: ${profile.skill_ratings[skillName]}</p>`);
                  }
                }

                const requestMatchButton = $('<button>Request Match</button>');
                requestMatchButton.click(function() {
                    requestMatch(profile.id);
                });
                profileCard.append(requestMatchButton);

                profileListDiv.append(profileCard);
            });

            hideAllForms();
            recommendedProfiles.show();

        } catch (error) {
            console.error('Error loading recommended profiles:', error);
            alert('Failed to load recommended profiles.  Please try again.');
        }
    }

    // ---- Match Requests ----

    function requestMatch(otherUserId) {
        $.ajax({
            url: '/request_match',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: JSON.stringify({ other_user_id: otherUserId }),
            success: function(data) {
                alert(data.message); // Or a more subtle notification
            },
            error: function(err) {
                alert('Failed to request match: ' + err.responseJSON.message);
            }
        });
    }

    // ---- Chat ----

    function openChat(otherUserId, otherUserName) {
        hideAllForms();
        chatInterface.show();
        chatPartnerSpan.text(otherUserName);

        // Load existing chat messages (if any)
        loadChatMessages(otherUserId);

        // Set up the "Send" button
        $('#send-button').off('click').on('click', function() {  // Remove any previous click handlers
            sendMessage(otherUserId);
        });

        // (Placeholder) Set up the video call button
        $('#video-call-button').off('click').on('click', function() {
            alert("Video call functionality is a placeholder.  Requires WebRTC implementation.");
            // **IMPLEMENT WEBRTC HERE** (using a library like simple-peer)
        });
    }

    function loadChatMessages(otherUserId) {
        $.ajax({
            url: `/chat_messages/${otherUserId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` },
            success: function(data) {
                chatMessages.empty();
                data.messages.forEach(message => {
                    const messageElement = $(`<p><strong>${message.sender_name}:</strong> ${message.text}</p>`);
                    chatMessages.append(messageElement);
                });
                chatMessages.scrollTop(chatMessages[0].scrollHeight);  // Scroll to bottom
            },
            error: function(err) {
                console.error('Failed to load chat messages:', err);
                alert('Failed to load chat messages.');
            }
        });
    }

    function sendMessage(otherUserId) {
        const messageText = messageInput.val().trim();
        if (messageText === '') return;

        $.ajax({
            url: '/send_message',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: JSON.stringify({ recipient_id: otherUserId, text: messageText }),
            success: function(data) {
                messageInput.val('');  // Clear the input
                loadChatMessages(otherUserId);  // Refresh messages
            },
            error: function(err) {
                console.error('Failed to send message:', err);
                alert('Failed to send message.');
            }
        });
    }

    // ---- Feedback ----

    function openFeedbackForm(otherUserId, otherUserName) {
        hideAllForms();
        feedbackForm.show();
        feedbackPartnerSpan.text(otherUserName);

        $('#submit-feedback').off('click').on('click', function() {
            submitFeedback(otherUserId);
        });
    }

    function submitFeedback(otherUserId) {
        const feedbackText = $('#feedback-text').val().trim();
        const rating = $('#feedback-rating').val();

        if (feedbackText === '' || isNaN(rating) || rating < 1 || rating > 5) {
            alert('Please provide feedback text and a rating between 1 and 5.');
            return;
        }

        $.ajax({
            url: '/submit_feedback',
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${userToken}` },
            data: JSON.stringify({ other_user_id: otherUserId, text: feedbackText, rating: rating }),
            success: function(data) {
                alert(data.message);
                feedbackForm.hide();  // Hide the feedback form
                loadRecommendedProfiles(); // Refresh recommendations, in case it impacts them
            },
            error: function(err) {
                console.error('Failed to submit feedback:', err);
                alert('Failed to submit feedback.');
            }
        });
    }

    // ---- Initialization ----

    if (isLoggedIn()) {
        logoutBtn.show();
        profileForm.show();
        loadProfileForm(); // Load the skills, and prefill profile data
    } else {
        loginForm.show();  // Or signupForm
    }

    // Example of how you might trigger a skill test (e.g., from the profile page, or after sign-up)
    // This is just an example; adjust the logic to fit your UI
    $(document).on('click', '.skill-offered-checkbox', function() {
        const skillId = $(this).val();
        const skillName = $(this).next('label').text(); // Get skill name from the label
        if (confirm(`Do you want to take a test for ${skillName}?`)) {
            startSkillTest(skillId);
        }
    });

    // Example of how you might trigger the chat and feedback from the recommendation page
    $(document).on('click', '.profile-card', function() {
        const profileId = $(this).data('profile-id');
        const profileName = $(this).find('h3').text();

        // Ask the user if they want to chat or give feedback
        const choice = prompt("Enter 'chat' to start a chat, or 'feedback' to give feedback:");
        if (choice === 'chat') {
            openChat(profileId, profileName);
        } else if (choice === 'feedback') {
            openFeedbackForm(profileId, profileName);
        }
    });
});

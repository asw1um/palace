#include <cerrno>
#include <cstddef>
#include <cstdlib>
#include <fcntl.h>
#include <iostream>
#include <ostream>
#include <string_view>
#include <fstream>
#include <string>
#include <iterator>
#include <signal.h>
#include <optional>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <sys/epoll.h>
#include <sys/fcntl.h>
#include <unistd.h>
#include <array>

/* Error Prototypes */
void fatal_error(std::string_view err_str);

/* Process Prototypes */
std::string get_backend_pid(std::string_view pid_path);
std::optional<bool> is_process_alive(int pid);

/* Networking Prototypes */
void evt();

/* Parser */
namespace parser
{
        enum token_type : unsigned char
        {
                T_INVALID,
                T_ALPHA,
                T_SPACE,
                T_SLASH,
                T_DIGIT,
                T_CR,
                T_LR
        };

        constexpr auto make_tok_lut()
        {
                std::array<token_type, 256> t{};
                for (int c = 'a'; c <= 'z'; ++c) t[c] = T_ALPHA;
                for (int c = 'A'; c <= 'Z'; ++c) t[c] = T_ALPHA;
                for (int c = '0'; c <= '9'; ++c) t[c] = T_DIGIT;
                t[' '] = T_SPACE;
                t['/'] = T_SLASH;
                t['\r'] = T_CR;
                t['\n'] = T_LR;
                return t;
        }

        static constexpr auto tok_lut = make_tok_lut();

        struct http_req
        {
                std::string method;
                std::string target;
        };

        enum parse_state
        {
                S_METHOD,
                S_TARGET
        };
        
        const parse_state parse_lut[] =
        {
                
        };
}

int main(int argc, char *argv[])
{
        std::string test_req = "GET / HTTP/1.1\r\n"; 
        std::array<parser::token_type, 18> toks = {};
        int i = 0;
        for(char *p = test_req.data(); *p != '\0'; ++p)
        {
                toks[i] = parser::tok_lut[*p];
                ++i;
        }
        std::cout << "Done token classification.\n";
}

// if (argc != 2)
//         fatal_error("Incorrect number of arguments\nUsage: program_name pid_path");
// auto pid_path = std::string_view{argv[1]};
// std::string pid = get_backend_pid(pid_path);
// if (pid.size() == 0) fatal_error("Failed to extract PID\n");
// auto pid_int = std::stoi(pid); 

// auto pid_status = is_process_alive(pid_int);
// if (!pid_status.has_value()) fatal_error("Failed to get process status\n");
// if (pid_status.value() == false) std::cout << "Process not running\n";
// if (pid_status.value() == true) std::cout << "Process is running\n";

/* Networking Definitions */

void evt()
{
        auto addr_info_status = int{};
        auto hints = addrinfo{};
        addrinfo *servinfo;

        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        hints.ai_flags = AI_PASSIVE;

        if ((addr_info_status = getaddrinfo(NULL, "8080", &hints, &servinfo)))
        {
                auto err = std::string{gai_strerror(addr_info_status)};
                fatal_error("getaddrinfo error: " + err);
        }
        
        auto main_fd = int{};
        for (auto p = servinfo; p != NULL; p = p->ai_next)
        {
                if ((main_fd = socket(p->ai_family, p->ai_socktype, p->ai_protocol)) == -1)
                {
                        perror("server: socket");
                        continue;
                }
                int yes = 1;
                if (setsockopt(main_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(int)) == -1)
                {
                        auto err = std::string{strerror(errno)};
                        fatal_error("setsockopt: " + err);
                }

                if (bind(main_fd, p->ai_addr, p->ai_addrlen) == -1)
                {
                        close(main_fd);
                        continue;
                }
                break;
        }

        freeaddrinfo(servinfo);

        if (listen(main_fd, 10) != 0)
        {
                auto err = std::string{strerror(errno)};
                fatal_error("listen() error: " + err);
        }
        /* Epoll */
        int epoll_fd = epoll_create1(0);
        if (epoll_fd == -1) fatal_error("Failed to create epoll file descriptor");
        struct epoll_event input_event, events[10];
        fcntl(main_fd, F_SETFD, O_NONBLOCK);
        input_event.data.fd = main_fd;
        input_event.events = EPOLLIN;
        if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, main_fd, &input_event) == -1)
        {
                auto err = std::string{strerror(errno)};
                fatal_error(err);
        }

        /* Main Loop */
        int nfds = -1;
        struct sockaddr_storage their_addr;
        socklen_t addr_size = sizeof their_addr;
        for(;;)
        {
                nfds = epoll_wait(epoll_fd, events, 10, -1);        
                if (nfds == -1) fatal_error("epoll_wait: ");

                for (int i = 0; i < nfds; ++i)
                {
                        if (events[i].data.fd == main_fd)
                        {
                                int new_fd = accept(main_fd, (struct sockaddr *)&their_addr, &addr_size);
                                std::cout << "Connection has appeared!\n";
                                char buf[4096];
                                recv(new_fd, buf, 4096, 0);
                                // Parse the request
                                  
                                close(new_fd);
                        }
                }
        }

        /* Cleanup */
}

/* Process Definitions */

std::optional<bool> is_process_alive(int pid)
{
        int res = kill(pid, 0);
        if (res == 0) return true;
        if (errno == ESRCH) return false;
        return std::nullopt;
}

std::string get_backend_pid(std::string_view pid_path)
{
        auto str = std::string{pid_path};
        std::ifstream file(str);
        if (file.is_open())
        {
                std::string pid((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
                std::cout << pid << std::endl;
                return pid;
        }
        return "";
}

/* Error Definitions */

void fatal_error(std::string_view err_str)
{
        std::cerr << "[FATAL ERROR]: " << err_str << std::endl;
        exit(EXIT_FAILURE);
}

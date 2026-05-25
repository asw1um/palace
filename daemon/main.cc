#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <ostream>
#include <string_view>
#include <fstream>
#include <string>
#include <iterator>
#include <signal.h>
#include <optional>

void fatal_error(std::string_view err_str);
std::string get_backend_pid(std::string_view pid_path);
std::optional<bool> is_process_alive(int pid);

int main(int argc, char *argv[])
{
        if (argc != 2)
                fatal_error("Incorrect number of arguments\nUsage: program_name pid_path");
        auto pid_path = std::string_view{argv[1]};
        std::string pid = get_backend_pid(pid_path);
        if (pid.size() == 0) fatal_error("Failed to extract PID\n");
        auto pid_int = std::stoi(pid); 
        
        auto pid_status = is_process_alive(pid_int);
        if (!pid_status.has_value()) fatal_error("Failed to get process status\n");
        if (pid_status.value() == false) std::cout << "Process not running\n";
        if (pid_status.value() == true) std::cout << "Process is running\n";
}

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

void fatal_error(std::string_view err_str)
{
        std::cerr << "[FATAL ERROR]: " << err_str << std::endl;
        exit(EXIT_FAILURE);
}
